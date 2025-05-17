import requests
from bs4 import BeautifulSoup
import pandas as pd

# Function to calculate the Herfindahl-Hirschman Index (HHI)
def calculate_hhi(city_populations):
    """Calculates the Herfindahl-Hirschman Index (HHI) for city populations."""
    total_population = sum(city_populations)
    hhi = sum((pop / total_population) ** 3.1416 * 100 for pop in city_populations)
    return hhi

# Function to get top cities' population for a given country (Online source)
def get_top_cities(country_name):
    """
    Scrapes the top 8 cities by population for a given country from citypopulation.de.
    Returns a list of city populations and city names.
    """
    url = f"https://www.citypopulation.de/en/{country_name.replace(' ', '')}/cities".lower()  # URL for country page
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    # Try to find the major cities table by either of two possible IDs: 'tlc' or 'tla'
    table = soup.find('table', {'id': 'tlc'}) or soup.find('table', {'id': 'tla'})
    
    # Extract the top 8 cities' populations
    if table:
        cities = []
        city_names = []
        rows = table.find_all('tr')[1:9]  # Get the first 8 cities (excluding header row)
        for row in rows:
            cells = row.find_all('td')
            if len(cells) > 3:  # Ensure there are enough columns in the row
                city_name = cells[1].text.strip()  # City name is in the second column
                city_population = int(cells[3].text.strip().replace(',', ''))  # Population is in the fourth column
                cities.append(city_population)
                city_names.append(city_name)
        return city_names, cities
    else:
        print(f"No cities table found for {country_name}.")
        return [], []

# Function to scrape data for a list of countries and calculate HHI (Online)
def scrape_and_calculate_hhi(countries):
    """
    Scrapes the city population data for each country and calculates the HHI.
    Returns a list of dictionaries with country names, city populations, and corresponding HHI values.
    """
    hhi_data = []
    city_data = []  # To store city-level data (name and population)

    for country in countries:
        print(f"Scraping data for {country}...")
        try:
            city_names, cities = get_top_cities(country)
            if cities:  # Ensure we have cities data
                hhi_value = calculate_hhi(cities)
                hhi_data.append({'Country': country, 'HHI': hhi_value})
                # Append city data for each country
                for city, pop in zip(city_names, cities):
                    city_data.append({'Country': country, 'City': city, 'Population': pop})
            else:
                print(f"Could not find the population data for {country}. Skipping...")
        except Exception as e:
            print(f"Error with {country}: {e}")
    
    return hhi_data, city_data

# Function to calculate HHI from local CSV data
def calculate_hhi_from_local(file_path):
    """
    Reads city population data from a local CSV file and calculates HHI for each country.
    Returns a list of dictionaries with country names, city populations, and corresponding HHI values.
    """
    try:
        data = pd.read_csv(file_path)
        hhi_data = []
        city_data = []

        for country in data['Country'].unique():
            country_data = data[data['Country'] == country]
            cities = country_data['Population'].tolist()
            city_names = country_data['City'].tolist()
            hhi_value = calculate_hhi(cities)

            hhi_data.append({'Country': country, 'HHI': hhi_value})
            for city, pop in zip(city_names, cities):
                city_data.append({'Country': country, 'City': city, 'Population': pop})

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
        hhi_df = hhi_df.sort_values(by="Country", ascending=True).reset_index(drop=True)
        print("HHI DataFrame after sorting: ")
        print(hhi_df.to_string())

        # Save HHI data to CSV
        hhi_df.to_csv('city_hhi_data.csv', index=False)
        print("HHI data saved to 'city_hhi_data.csv'.")

    if city_data:
        # Convert city-level data to a DataFrame with explicit column order: 'Country', 'City', 'Population'
        city_df = pd.DataFrame(city_data, columns=['Country', 'City', 'Population'])
        # Save city-level data to CSV with the correct column order
        city_df.to_csv('city_population_data.csv', index=False)
        print("City population data saved to 'city_population_data.csv'.")

# Main function to decide data source and calculate HHI
def main(use_local, local_file_path, countries):
    """Main function to choose data source and calculate HHI."""
    if use_local:
        print("Using local data...")
        hhi_data, city_data = calculate_hhi_from_local(local_file_path)
    else:
        print("Using online data...")
        hhi_data, city_data = scrape_and_calculate_hhi(countries)

    # Display and save the collected data
    display_and_save_data(hhi_data, city_data)

# List of countries to scrape
countries = [
    'USA', 'Canada', 'Mexico', 
    'Cuba', 'Haiti', 'Dom Rep', 'Jamaica', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama',
    'Argentina', 'Brazil', 'Chile', 
    'Colombia', 'Ecuador', 'Peru', 'Paraguay', 'Venezuela', 'Uruguay',
    'UK', 'Ireland', 'Iceland', 'Norway', 'Sweden', 'Finland', 'Denmark', 'Germany', 'France', 'Italy', 'Switzerland', 'Netherlands', 'Belgium', 'Spain', 'Portugal', 'Austria',
    'Russia', 'Ukraine', 'Belarus', 'Poland', 'Lithuania', 'Latvia', 'Estonia', 'Moldova', 'Hungary', 'Czechrep', 'Slovakia', 'Slovenia',
    'Croatia', 'Romania', 'Bulgaria', 'Serbia', 'Bosnia', 'Montenegro', 'North Macedonia', 'Albania', 'Greece', 'Luxembourg', 'Cyprus',
    'Turkey', 'Armenia', 'Azerbaijan', 'Georgia', 'Kazakhstan',
    'China', 'Japan', 'South Korea', 'North Korea', 'Mongolia', 'Thailand', 'Vietnam', 'Cambodia', 'Laos', 'Philippines', 'Myanmar', 'Indonesia', 'Malaysia', 
    'India', 'Pakistan', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Afghanistan', 'Iran', 'Iraq', 'Saudi Arabia', 'Qatar', 'Syria', 'Israel', 
    'UAE', 'Jordan', 'Lebanon',
    'Egypt', 'Ethiopia', 'Nigeria', 'South Africa',
    'Australia', 'New Zealand',
    ]


# Path to the local CSV file
local_file_path = 'city_population_curated.csv'

# Use local or online data source
use_local = False  # Set to False to scrape data online

# Run the main function
main(use_local, local_file_path, countries)
