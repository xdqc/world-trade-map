import pandas as pd
import json

def load_trade_data(file_path, trade_type, partner_name):
    """Load trade data and rename columns with type (import/export) and partner name"""
    with open(file_path, 'r') as f:
        raw_data = json.load(f)
    
    df = pd.DataFrame(raw_data['data'])
    df.rename(columns={'Trade Value': f'{trade_type}_{partner_name}'}, inplace=True)
    if trade_type == 'Import':
        df.rename(columns={'Exporter Continent': 'Continent'}, inplace=True)
        df.rename(columns={'Exporter Country ID': 'ISO 3'}, inplace=True)
        df.rename(columns={'Exporter Country': 'Country'}, inplace=True)
    elif trade_type == 'Export':
        df.rename(columns={'Importer Continent': 'Continent'}, inplace=True)
        df.rename(columns={'Importer Country ID': 'ISO 3'}, inplace=True)
        df.rename(columns={'Importer Country': 'Country'}, inplace=True)
    return df[['Continent', 'ISO 3', 'Country', f'{trade_type}_{partner_name}']]

# Load all data
imports = {
    'China': load_trade_data('import_cn_2023.json', 'Import', 'China'),
    'USA': load_trade_data('import_us_2023.json', 'Import', 'USA'),
    'EU': load_trade_data('import_eu_2023.json', 'Import', 'EU')
}

exports = {
    'China': load_trade_data('export_cn_2023.json', 'Export', 'China'),
    'USA': load_trade_data('export_us_2023.json', 'Export', 'USA'),
    'EU': load_trade_data('export_eu_2023.json', 'Export', 'EU')
}

# Combine all data into single dataframe
combined = pd.merge(
    pd.merge(imports['China'], imports['USA'], on=['Continent', 'ISO 3', 'Country']),
    imports['EU'], on=['Continent', 'ISO 3', 'Country']
).merge(
    pd.merge(exports['China'], exports['USA'], on=['Continent', 'ISO 3', 'Country']),
    on=['Continent', 'ISO 3', 'Country']
).merge(
    exports['EU'], on=['Continent', 'ISO 3', 'Country']
)

# Calculate total trade for each partner
for partner in ['China', 'USA', 'EU']:
    combined[f'Total_{partner}'] = combined[f'Import_{partner}'] + combined[f'Export_{partner}']

# Calculate deficit/surplus trade for each partner
for partner in ['China', 'USA', 'EU']:
    combined[f'DefSur_{partner}'] = combined[f'Import_{partner}'] - combined[f'Export_{partner}']

# Find top trading partner
total_columns = [f'Total_{partner}' for partner in ['China', 'USA', 'EU']]
combined['Top_Partner'] = combined[total_columns].idxmax(axis=1).str.replace('Total_', '')

# Find top Importer
total_columns = [f'Import_{partner}' for partner in ['China', 'USA', 'EU']]
combined['Top_Importer'] = combined[total_columns].idxmax(axis=1).str.replace('Import_', '')

# Find top Exporter
total_columns = [f'Export_{partner}' for partner in ['China', 'USA', 'EU']]
combined['Top_Exporter'] = combined[total_columns].idxmax(axis=1).str.replace('Export_', '')


# Find top absulute surplus/deficit
defsur_columns = [f'DefSur_{partner}' for partner in ['China', 'USA', 'EU']]
combined['Top_DefSur'] = combined[defsur_columns].abs().idxmax(axis=1).str.replace('DefSur_', '')

# Partner with largest trade deficit (max value)
combined['Most_Deficit'] = combined[defsur_columns].idxmax(axis=1).str.replace('DefSur_', '')

# Partner with largest trade surplus (min value)
combined['Most_Surplus'] = combined[defsur_columns].idxmin(axis=1).str.replace('DefSur_', '')


# Create final sorted output
final_df = combined.sort_values([
        'Most_Surplus', 
        'Top_Exporter',
        'Top_Partner',
        'Top_Importer',
        'Most_Deficit', 
        'Continent', 'Country'])[
    [
        'Continent', 
        'Country', 
        'Top_Partner', 'Top_Importer', 'Top_Exporter',
        'Most_Deficit', 'Most_Surplus',
        'Total_China', 'Total_USA', 'Total_EU',
        'DefSur_China', 'DefSur_USA', 'DefSur_EU',
        'Import_China', 'Export_China',
        'Import_USA', 'Export_USA',
        'Import_EU', 'Export_EU',
    ]
]

# Save to CSV
final_df.to_csv('most_total_trade.csv', index=False)

# Print full results
pd.set_option('display.max_columns', None)
pd.set_option('display.width', 1000)
print("\nTotal Trade Analysis Results:")
print(final_df.to_string(index=False))
