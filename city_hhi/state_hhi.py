import requests
from bs4 import BeautifulSoup
import pandas as pd

# Function to calculate the Herfindahl-Hirschman Index (HHI)
def calculate_hhi(city_populations):
    """Calculates the Herfindahl-Hirschman Index (HHI) for city populations."""
    total_population = sum(city_populations)
    hhi = sum((pop / total_population) ** 2 * 100 for pop in city_populations)
    return hhi

# Function to get top cities' population for a given state (Online source)
def get_top_cities(state_code, state_name):
    """
    Scrapes the top 5 cities by population for a given state from citypopulation.de.
    Returns a list of city populations and city names.
    """
    url = f"https://www.citypopulation.de/en/usa/ua/{state_code}__{state_name.lower().replace(' ', '_')}/"
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    # Find the major cities table
    table = soup.find('table', {'id': 'ts'})
    
    # Extract and sort cities by population
    if table:
        cities = []
        city_names = []
        rows = table.find('tbody').find_all('tr')
        city_data = []
        for row in rows:
            cells = row.find_all('td')
            if len(cells) > 5:  # Ensure there are enough columns in the row
                city_name = cells[0].text.strip()  # City name in the first column
                city_population = int(cells[5].text.strip().replace(',', ''))  # Population (2020) in the sixth column
                city_data.append((city_name, city_population))
        
        # Sort by population in descending order and take the top 5
        city_data.sort(key=lambda x: x[1], reverse=True)
        city_data = city_data[:9]

        for city_name, city_population in city_data:
            cities.append(city_population)
            city_names.append(city_name)
        
        return city_names, cities
    else:
        print(f"No cities table found for {state_name}.")
        return [], []

# Function to scrape data for a list of states and calculate HHI (Online)
def scrape_and_calculate_hhi(states):
    """
    Scrapes the city population data for each state and calculates the HHI.
    Returns a list of dictionaries with state names, city populations, and corresponding HHI values.
    """
    hhi_data = []
    city_data = []  # To store city-level data (name and population)

    for state_code, state_name in states.items():
        print(f"Scraping data for {state_name}...")
        try:
            city_names, cities = get_top_cities(state_code, state_name)
            if cities:  # Ensure we have cities data
                hhi_value = calculate_hhi(cities)
                hhi_data.append({'State': state_name, 'HHI': hhi_value})
                # Append city data for each state
                for city, pop in zip(city_names, cities):
                    city_data.append({'State': state_name, 'City': city, 'Population': pop})
            else:
                print(f"Could not find the population data for {state_name}. Skipping...")
        except Exception as e:
            print(f"Error with {state_name}: {e}")
    
    return hhi_data, city_data

def calculate_hhi_from_local(file_path):
    """
    Reads city population data from a local CSV file and calculates HHI for each state
    Returns a list of dictionaries with state names, city populations, and HHI values.
    """
    try:
        # Load data
        data = pd.read_csv(file_path)
        hhi_data = []
        city_data = []

        # Process each state
        for state in data['State'].unique():
            state_data = data[data['State'] == state]
            # Sort by population in descending order
            state_data = state_data.sort_values(by='Population', ascending=False)
            
            # Select top 6 cities (or fewer if less than 6 exist)
            top_cities = state_data.head(6)
            
            # Extract populations and city names
            cities = top_cities['Population'].tolist()
            city_names = top_cities['City'].tolist()

            # Calculate HHI
            hhi_value = calculate_hhi(cities)

            # Append results
            hhi_data.append({'State': state, 'HHI': hhi_value})
            for city, pop in zip(city_names, cities):
                city_data.append({'State': state, 'City': city, 'Population': pop})

        return hhi_data, city_data

    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return [], []


# Function to display and save the data
def display_and_save_data(hhi_data, city_data):
    """Converts the HHI data and city data to DataFrames, sorts them, and saves them to CSV files."""
    if hhi_data:
        # Convert HHI data to a DataFrame for easy display/analysis
        hhi_df = pd.DataFrame(hhi_data)
        # Sort by HHI value (optional)
        hhi_df = hhi_df.sort_values(by="State", ascending=True).reset_index(drop=True)
        print("HHI DataFrame after sorting: ")
        print(hhi_df.to_string())

        # Save HHI data to CSV
        hhi_df.to_csv('state_hhi_data.csv', index=False)
        print("HHI data saved to 'state_hhi_data.csv'.")

    if city_data:
        # Convert city-level data to a DataFrame with explicit column order: 'State', 'City', 'Population'
        city_df = pd.DataFrame(city_data, columns=['State', 'City', 'Population'])
        # Save city-level data to CSV with the correct column order
        city_df.to_csv('state_population_data.csv', index=False)
        print("City population data saved to 'state_population_data.csv'.")

# Main function to decide data source and calculate HHI
def main(use_local, local_file_path, states):
    """Main function to choose data source and calculate HHI."""
    if use_local:
        print("Using local data...")
        hhi_data, city_data = calculate_hhi_from_local(local_file_path)
    else:
        print("Using online data...")
        hhi_data, city_data = scrape_and_calculate_hhi(states)

    # Display and save the collected data
    display_and_save_data(hhi_data, city_data)

# Dictionary of state codes and names for scraping
state_codes = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire',
    'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina',
    'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania',
    'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee',
    'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington',
    'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
}

# Path to the local CSV file
local_file_path = 'state_population_curated.csv'

# Use local or online data source
use_local = True  # Set to False to scrape data online

# Run the main function
main(use_local, local_file_path, state_codes)
