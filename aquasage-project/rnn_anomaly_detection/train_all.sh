#!/bin/bash

DIR="../data/processed_flow_data/"

# Use glob pattern to handle spaces correctly
for filepath in "$DIR"*.csv; do
    # Extract just the filename
    filename=$(basename "$filepath")
    # Replace .csv with .pkl
    pkl_filename="${filename%.csv}.pkl"
    
    echo "Processing file: $pkl_filename"
    conda run --no-capture-output -n deep python train_predictor.py --data custom --filename "$pkl_filename" --epochs 50 --device cpu --prediction_window_size 24 --nlayers 2 --num_runs 5 

    echo "Processing file for anomaly detection: $pkl_filename"
    conda run --no-capture-output -n deep python anomaly_detection.py --data custom --filename "$pkl_filename" --prediction_window_size 24 --num_runs 5 --save_fig
    
done
