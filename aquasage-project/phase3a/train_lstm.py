"""
Phase 3A: PyTorch LSTM Flow Predictor Training Script.
Trains an autoregressive LSTM predictor strictly on the historical normal Train split.
Applies early stopping on the normal Validation split.
"""

import os
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import time
import json
import torch
import torch.nn as nn
import numpy as np
import pandas as pd


# Set seeds for exact reproducibility
SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)


class FlowLSTM(nn.Module):
    """
    Autoregressive Recurrent Neural Predictor:
    Takes past seq_len hourly readings and predicts the next 1-step ahead flow.
    Reuses standard stacked LSTM architecture with dropout and linear decoder.
    """
    def __init__(self, input_size=1, hidden_size=32, num_layers=2, dropout=0.2):
        super(FlowLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(
            input_size,
            hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        # x: [batch_size, seq_len, 1]
        out, _ = self.lstm(x)
        # Take hidden state of last timestep
        out = self.fc(out[:, -1, :])
        return out


def make_sequences(data_series: np.ndarray, seq_len: int = 24):
    """Generate rolling windows of past readings strictly without future values."""
    xs, ys = [], []
    for i in range(len(data_series) - seq_len):
        xs.append(data_series[i:i + seq_len])
        ys.append(data_series[i + seq_len])
    return np.array(xs, dtype=np.float32)[..., np.newaxis], np.array(ys, dtype=np.float32)[..., np.newaxis]


def train_lstm_pipeline(
    splits_dir: str = "data/splits/Area_1",
    output_dir: str = "phase3a/models",
    seq_len: int = 24,
    hidden_size: int = 32,
    num_layers: int = 2,
    dropout: float = 0.2,
    lr: float = 0.001,
    batch_size: int = 64,
    max_epochs: int = 30,
    patience: int = 7
):
    start_time = time.time()
    os.makedirs(output_dir, exist_ok=True)

    print("--- 1. Loading Training and Validation Splits ---")
    train_df = pd.read_csv(os.path.join(splits_dir, "train.csv"))
    val_df = pd.read_csv(os.path.join(splits_dir, "val.csv"))

    train_df['result_time'] = pd.to_datetime(train_df['result_time'])
    val_df['result_time'] = pd.to_datetime(val_df['result_time'])

    print(f"Train period: {train_df['result_time'].min()} to {train_df['result_time'].max()} ({len(train_df)} hrs)")
    print(f"Val period:   {val_df['result_time'].min()} to {val_df['result_time'].max()} ({len(val_df)} hrs)")

    # Compute scaling parameters strictly on training set
    train_mean = float(train_df['Flow'].mean())
    train_std = float(train_df['Flow'].std())
    print(f"Fitted Scaler (Train Only): mean = {train_mean:.4f}, std = {train_std:.4f}")

    scaler_path = os.path.join(output_dir, "scaler_params.json")
    with open(scaler_path, "w") as f:
        json.dump({"mean": train_mean, "std": train_std}, f, indent=2)

    # Standardize splits using train statistics
    train_scaled = (train_df['Flow'].values - train_mean) / train_std
    val_scaled = (val_df['Flow'].values - train_mean) / train_std

    # Prepare sequential tensors
    X_train, y_train = make_sequences(train_scaled, seq_len=seq_len)
    X_val, y_val = make_sequences(val_scaled, seq_len=seq_len)

    train_dataset = torch.utils.data.TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
    val_dataset = torch.utils.data.TensorDataset(torch.from_numpy(X_val), torch.from_numpy(y_val))

    train_loader = torch.utils.data.DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = torch.utils.data.DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    print(f"Sequence dimensions: X_train = {X_train.shape}, X_val = {X_val.shape}")

    # Build model
    model = FlowLSTM(input_size=1, hidden_size=hidden_size, num_layers=num_layers, dropout=dropout)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)

    print("\n--- 2. Training LSTM Predictor ---")
    best_val_loss = float('inf')
    best_epoch = 0
    best_weights = None
    epochs_no_improve = 0

    history = []

    for epoch in range(1, max_epochs + 1):
        model.train()
        train_loss = 0.0
        for bx, by in train_loader:
            optimizer.zero_grad()
            pred = model(bx)
            loss = criterion(pred, by)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * len(bx)
        train_loss /= len(X_train)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for bx, by in val_loader:
                pred = model(bx)
                loss = criterion(pred, by)
                val_loss += loss.item() * len(bx)
        val_loss /= len(X_val)

        history.append({'epoch': epoch, 'train_mse': train_loss, 'val_mse': val_loss})

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_epoch = epoch
            best_weights = model.state_dict().copy()
            epochs_no_improve = 0
            flag = "*"
        else:
            epochs_no_improve += 1
            flag = ""

        if epoch % 2 == 0 or epoch == max_epochs:
            print(f"Epoch {epoch:2d}/{max_epochs} | Train MSE: {train_loss:.4f} | Val MSE: {val_loss:.4f} {flag}")

        if epochs_no_improve >= patience:
            print(f"Early stopping triggered at epoch {epoch} (best epoch {best_epoch} with Val MSE {best_val_loss:.4f})")
            break

    # Restore best weights
    model.load_state_dict(best_weights)
    model.eval()

    total_time = time.time() - start_time
    print(f"Training completed in {total_time:.2f}s.")

    # Save model checkpoint and metadata
    model_path = os.path.join(output_dir, "lstm_predictor.pth")
    torch.save({
        'model_state_dict': model.state_dict(),
        'best_val_loss': best_val_loss,
        'best_epoch': best_epoch,
        'config': {
            'seq_len': seq_len,
            'hidden_size': hidden_size,
            'num_layers': num_layers,
            'dropout': dropout,
            'lr': lr,
            'seed': SEED
        },
        'scaler': {
            'mean': train_mean,
            'std': train_std
        }
    }, model_path)

    config_path = os.path.join(output_dir, "model_config.json")
    with open(config_path, "w") as f:
        json.dump({
            'model_name': 'FlowLSTM',
            'seq_len': seq_len,
            'hidden_size': hidden_size,
            'num_layers': num_layers,
            'dropout': dropout,
            'learning_rate': lr,
            'best_epoch': best_epoch,
            'best_val_mse': round(best_val_loss, 5),
            'runtime_seconds': round(total_time, 2),
            'seed': SEED
        }, f, indent=2)

    print(f"Saved best model checkpoint to {model_path}")
    print(f"Saved configuration to {config_path}")
    return model, best_val_loss


if __name__ == '__main__':
    train_lstm_pipeline()
