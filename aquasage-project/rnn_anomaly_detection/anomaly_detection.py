import argparse
import torch
import pickle
import preprocess_data
from model import model
from torch import optim
from pathlib import Path
from matplotlib import pyplot as plt
import numpy as np
from sklearn.svm import SVR
from sklearn.model_selection import GridSearchCV
from anomalyDetector import fit_norm_distribution_param
from anomalyDetector import anomalyScore
from anomalyDetector import get_precision_recall
parser = argparse.ArgumentParser(description='PyTorch RNN Anomaly Detection Model')
parser.add_argument('--prediction_window_size', type=int, default=10,
                    help='prediction_window_size')
parser.add_argument('--data', type=str, default='ecg',
                    help='type of the dataset (ecg, gesture, power_demand, space_shuttle, respiration, nyc_taxi')
parser.add_argument('--filename', type=str, default='chfdb_chf13_45590.pkl',
                    help='filename of the dataset')
parser.add_argument('--save_fig', action='store_true',
                    help='save results as figures')
parser.add_argument('--compensate', action='store_true',
                    help='compensate anomaly score using anomaly score esimation')
parser.add_argument('--beta', type=float, default=1.0,
                    help='beta value for f-beta score')
parser.add_argument('--plot_start', type=int, default=None,
                    help='start index for zooming in fig_scores plot (default: 0)')
parser.add_argument('--plot_end', type=int, default=None,
                    help='end index for zooming in fig_scores plot (default: len(test_dataset))')
parser.add_argument('--num_runs', type=int, default=1, 
                    help='number of runs with different random seeds (for calculating mean and covariance of prediction errors)')


args_ = parser.parse_args()
print('-' * 89)
print("=> loading checkpoint ")
checkpoint = torch.load(str(Path('save',args_.data,'checkpoint',args_.filename).with_suffix('.pth')))
args = checkpoint['args']
args.prediction_window_size= args_.prediction_window_size
args.beta = args_.beta
args.save_fig = args_.save_fig
args.compensate = args_.compensate
args.plot_start = args_.plot_start
args.plot_end = args_.plot_end
args.num_runs = args_.num_runs
print("=> loaded checkpoint")


# Set the random seed manually for reproducibility.
torch.manual_seed(args.seed)
torch.cuda.manual_seed(args.seed)

###############################################################################
# Load data
###############################################################################
TimeseriesData = preprocess_data.PickleDataLoad(data_type=args.data,filename=args.filename, augment_test_data=False)
train_dataset = TimeseriesData.batchify(args,TimeseriesData.trainData[:TimeseriesData.length], bsz=1)
test_dataset = TimeseriesData.batchify(args,TimeseriesData.testData, bsz=1)
calibration_dataset = TimeseriesData.batchify(args,TimeseriesData.calData, bsz=1)

###############################################################################
# Build the model
###############################################################################
filename = args_.filename.split('.')[0]
for run in range(args.num_runs):
    torch.manual_seed(args.seed + run)
    torch.cuda.manual_seed(args.seed + run)
    print('=' * 89)
    print(f'Run {run+1}/{args.num_runs} with random seed {args.seed + run}')

    checkpoint = torch.load(str(Path('save',args_.data,'checkpoint', args.filename).with_suffix('.pth')))
    args = checkpoint['args']
    args.prediction_window_size= args_.prediction_window_size
    args.beta = args_.beta
    args.save_fig = args_.save_fig
    args.compensate = args_.compensate
    args.plot_start = args_.plot_start
    args.plot_end = args_.plot_end
    args.num_runs = args_.num_runs
    args.filename = filename + '_run' + str(run+1) + '.pkl' 

    nfeatures = TimeseriesData.trainData.size(-1)
    network = model.RNNPredictor(rnn_type = args.model,
                            enc_inp_size=nfeatures,
                            rnn_inp_size = args.emsize,
                            rnn_hid_size = args.nhid,
                            dec_out_size=nfeatures,
                            nlayers = args.nlayers,
                            res_connection=args.res_connection).to(args.device)
    network.load_state_dict(checkpoint['state_dict'])
    #del checkpoint

    scores, predicted_scores, precisions, recalls, f_betas, thresholds_list = list(), list(), list(), list(), list(), list()
    targets, mean_predictions, oneStep_predictions, Nstep_predictions = list(), list(), list(), list()
    try:
        # For each channel in the dataset
        for channel_idx in range(nfeatures):
            ''' 1. Load mean and covariance if they are pre-calculated, if not calculate them. '''
            # Mean and covariance are calculated on train dataset.
            if 'means' in checkpoint.keys() and 'covs' in checkpoint.keys():
                print('=> loading pre-calculated mean and covariance')
                mean, cov = checkpoint['means'][channel_idx], checkpoint['covs'][channel_idx]
            else:
                print('=> calculating mean and covariance')
                mean, cov = fit_norm_distribution_param(args, network, train_dataset, channel_idx=channel_idx)

            ''' 2. Train anomaly score predictor using support vector regression (SVR). (Optional) '''
            # An anomaly score predictor is trained
            # given hidden layer output and the corresponding anomaly score on train dataset.
            # Predicted anomaly scores on test dataset can be used for the baseline of the adaptive threshold.
            if args.compensate:
                print('=> training an SVR as anomaly score predictor')
                train_score, _, _, hiddens, _ = anomalyScore(args, network, train_dataset, mean, cov, channel_idx=channel_idx)
                score_predictor = GridSearchCV(SVR(), cv=5,param_grid={"C": [1e0, 1e1, 1e2],"gamma": np.logspace(-1, 1, 3)})
                score_predictor.fit(torch.cat(hiddens,dim=0).numpy(), train_score.cpu().numpy())
            else:
                score_predictor=None

            ''' 3. Calculate anomaly scores'''
            # Anomaly scores are calculated on the test dataset
            # given the mean and the covariance calculated on the train dataset
            print('=> calculating anomaly scores')
            
            # Calculate scores on calibration set to find optimal threshold
            if args.compensate:
                cal_score, _, _, _, cal_predicted_score = anomalyScore(args, network, calibration_dataset, mean, cov,
                                                                    score_predictor=score_predictor,
                                                                    channel_idx=channel_idx)
            else:
                cal_score, _, _, _, _ = anomalyScore(args, network, calibration_dataset, mean, cov,
                                                    score_predictor=score_predictor,
                                                    channel_idx=channel_idx)
                
            score, sorted_prediction, sorted_error, _, predicted_score = anomalyScore(args, network, test_dataset, mean, cov,
                                                                                    score_predictor=score_predictor,
                                                                                    channel_idx=channel_idx)

            ''' 4. Evaluate the result '''
            # The obtained anomaly scores are evaluated by measuring precision, recall, and f_beta scores
            # The precision, recall, f_beta scores are are calculated repeatedly,
            # sampling the threshold from 1 to the maximum anomaly score value, either equidistantly or logarithmically.
            print('=> calculating precision, recall, and f_beta')

            # Use calibration set to determine threshold
            precision, recall, f_beta, thresholds = get_precision_recall(args, cal_score, num_samples=1000, beta=args.beta,
                                                            label=TimeseriesData.calLabel.to(args.device))
            
            if len(f_beta) > 0:
                optimal_threshold = thresholds[f_beta.argmax()].item()
            else:
                optimal_threshold = None

            # Re-calculate metrics on test set using the determined threshold (or full range for plotting)
            # Note: get_precision_recall sweeps thresholds. To evaluate a specific threshold on test set, 
            # we often just want the scalar metrics, but here we keep the sweep for plotting curves.
            # Ideally, we report the metric at optimal_threshold.
            
            precision, recall, f_beta, test_thresholds = get_precision_recall(args, score, num_samples=1000, beta=args.beta,
                                                            label=TimeseriesData.testLabel.to(args.device))

            print('data: ',args.data,' filename: ',args.filename,
                ' f-beta (no compensation): ', f_beta.max().item(),' beta: ',args.beta)
            if args.compensate:
                # Use calibration set with compensation to find optimal threshold
                precision, recall, f_beta, thresholds = get_precision_recall(args, cal_score, num_samples=1000, beta=args.beta,
                                                                label=TimeseriesData.calLabel.to(args.device),
                                                                predicted_score=cal_predicted_score)
                if len(f_beta) > 0:
                    optimal_threshold = thresholds[f_beta.argmax()].item()
                
                # Recalculate on test set
                precision, recall, f_beta, test_thresholds = get_precision_recall(args, score, num_samples=1000, beta=args.beta,
                                                                label=TimeseriesData.testLabel.to(args.device),
                                                                predicted_score=predicted_score)
                    
                print('data: ',args.data,' filename: ',args.filename,
                    ' f-beta    (compensation): ', f_beta.max().item(),' beta: ',args.beta)


            target = preprocess_data.reconstruct(test_dataset.cpu()[:, 0, channel_idx],
                                                TimeseriesData.mean[channel_idx],
                                                TimeseriesData.std[channel_idx]).numpy()
            mean_prediction = preprocess_data.reconstruct(sorted_prediction.mean(dim=1).cpu(),
                                                        TimeseriesData.mean[channel_idx],
                                                        TimeseriesData.std[channel_idx]).numpy()
            oneStep_prediction = preprocess_data.reconstruct(sorted_prediction[:, -1].cpu(),
                                                            TimeseriesData.mean[channel_idx],
                                                            TimeseriesData.std[channel_idx]).numpy()
            Nstep_prediction = preprocess_data.reconstruct(sorted_prediction[:, 0].cpu(),
                                                        TimeseriesData.mean[channel_idx],
                                                        TimeseriesData.std[channel_idx]).numpy()
            sorted_errors_mean = sorted_error.abs().mean(dim=1).cpu()
            sorted_errors_mean *= TimeseriesData.std[channel_idx]
            sorted_errors_mean = sorted_errors_mean.numpy()
            score = score.cpu()
            scores.append(score), targets.append(target), predicted_scores.append(predicted_score)
            mean_predictions.append(mean_prediction), oneStep_predictions.append(oneStep_prediction)
            Nstep_predictions.append(Nstep_prediction)
            precisions.append(precision), recalls.append(recall), f_betas.append(f_beta)
            thresholds_list.append(test_thresholds)


            if args.save_fig:
                save_dir = Path('result',args.data,args.filename).with_suffix('').joinpath('fig_detection')
                save_dir.mkdir(parents=True,exist_ok=True)
                plt.plot(precision.cpu().numpy(),label='precision')
                plt.plot(recall.cpu().numpy(),label='recall')
                plt.plot(f_beta.cpu().numpy(), label='f1')
                plt.legend()
                plt.xlabel('Threshold (log scale)')
                plt.ylabel('Value')
                plt.title('Anomaly Detection on ' + args.data + ' Dataset', fontsize=18, fontweight='bold')
                plt.savefig(str(save_dir.joinpath('fig_f_beta_channel'+str(channel_idx)).with_suffix('.png')))
                plt.close()


                fig, ax1 = plt.subplots(figsize=(15,5))
                

                # Highlight ground truth anomalous periods
                test_labels = TimeseriesData.testLabel.cpu().numpy()
                in_anomaly = False
                anomaly_start = 0
                for i in range(len(test_labels)):
                    if test_labels[i] == 1 and not in_anomaly:
                        anomaly_start = i
                        in_anomaly = True
                    elif test_labels[i] == 0 and in_anomaly:
                        ax1.axvspan(anomaly_start, i, color='yellow', alpha=0.2)
                        in_anomaly = False
                # Handle case where anomaly extends to the end
                if in_anomaly:
                    ax1.axvspan(anomaly_start, len(test_labels), color='yellow', alpha=0.2)
                
                ax1.plot(target,label='Target',
                        color='black', marker='.', linestyle='--', markersize=1, linewidth=1.5)
                ax1.plot(mean_prediction, label='Mean predictions',
                        color='purple', marker='.', linestyle='--', markersize=1, linewidth=1.5)
                #ax1.plot(oneStep_prediction, label='1-step predictions',
                    #color='green', marker='.', linestyle='--', markersize=1, linewidth=0.5)
                # ax1.plot(Nstep_prediction, label=str(args.prediction_window_size) + '-step predictions',
                #          color='blue', marker='.', linestyle='--', markersize=1, linewidth=0.5)
                ax1.plot(sorted_errors_mean,label='Absolute mean prediction errors',
                        color='orange', marker='.', linestyle='--', markersize=1, linewidth=1.0)
                ax1.legend(loc='upper left', fontsize=12)
                ax1.set_ylabel('Value',fontsize=15)
                ax1.set_xlabel('Index',fontsize=15)
                ax2 = ax1.twinx()
                ax2.plot(score.numpy().reshape(-1, 1), label='Anomaly scores',
                        color='red', marker='.', linestyle='--', markersize=1, linewidth=1)
                if args.compensate:
                    ax2.plot(predicted_score, label='Predicted anomaly scores from SVR',
                            color='cyan', marker='.', linestyle='--', markersize=1, linewidth=1)
                # Add optimal threshold line
                if optimal_threshold is not None:
                    ax2.axhline(y=optimal_threshold, color='black', linestyle=':', linewidth=2, 
                            label=f'Threshold ({optimal_threshold:.2f})')
                #ax2.plot(score.reshape(-1,1)/(predicted_score+1),label='Anomaly scores from \nmultivariate normal distribution',
                #        color='hotpink', marker='.', linestyle='--', markersize=1, linewidth=1)
                ax2.legend(loc='upper right', fontsize=12)
                ax2.set_ylabel('anomaly score',fontsize=15)
                #plt.axvspan(2830,2900 , color='yellow', alpha=0.3)
                #plt.title('Anomaly Detection on ' + args.data + ' Dataset', fontsize=18, fontweight='bold')
                plt.tight_layout()

                # -----------------------------
                # Set plot x-axis limits (zoom)
                plot_start = args.plot_start if args.plot_start is not None else 0
                plot_end = args.plot_end if args.plot_end is not None else len(test_dataset)
                # -----------------------------

                plt.xlim([plot_start, plot_end])
                plt.savefig(str(save_dir.joinpath('fig_scores_channel'+str(channel_idx)).with_suffix('.png')))
                #plt.show()
                plt.close()


    except KeyboardInterrupt:
        print('-' * 89)
        print('Exiting from training early')


    print('=> saving the results as pickle extensions')
    save_dir = Path('result', args.data, args.filename).with_suffix('')
    save_dir.mkdir(parents=True, exist_ok=True)
    pickle.dump(targets, open(str(save_dir.joinpath('target.pkl')),'wb'))
    pickle.dump(mean_predictions, open(str(save_dir.joinpath('mean_predictions.pkl')),'wb'))
    pickle.dump(oneStep_predictions, open(str(save_dir.joinpath('oneStep_predictions.pkl')),'wb'))
    pickle.dump(Nstep_predictions, open(str(save_dir.joinpath('Nstep_predictions.pkl')),'wb'))
    pickle.dump(scores, open(str(save_dir.joinpath('score.pkl')),'wb'))
    pickle.dump(predicted_scores, open(str(save_dir.joinpath('predicted_scores.pkl')),'wb'))
    pickle.dump(precisions, open(str(save_dir.joinpath('precision.pkl')),'wb'))
    pickle.dump(recalls, open(str(save_dir.joinpath('recall.pkl')),'wb'))
    pickle.dump(f_betas, open(str(save_dir.joinpath('f_beta.pkl')),'wb'))
    pickle.dump(optimal_threshold, open(str(save_dir.joinpath('optimal_threshold.pkl')),'wb'))
    pickle.dump(thresholds_list, open(str(save_dir.joinpath('thresholds_list.pkl')),'wb'))
    print('-' * 89)
