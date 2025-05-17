import requests
from bs4 import BeautifulSoup
import pandas as pd

# Function to calculate the Herfindahl-Hirschman Index (HHI)
def calculate_hhi(city_populations):
    """Calculates the Herfindahl-Hirschman Index (HHI) for city populations."""
    total_population = sum(city_populations)
    hhi = sum((pop / total_population) ** 2 * 100 for pop in city_populations)
    return hhi

# Function to get all cities' population for a given province (China)
def get_all_cities(province_name):
    """
    Scrapes all cities by population for a given Chinese province from citypopulation.de.
    Returns a sorted list of city populations and city names in descending order of population.
    """
    # Format the URL based on province name
    url = f"https://www.citypopulation.de/en/china/cities/{province_name.lower().replace(' ', '_')}/"
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    # Find the table with ID 'ts'
    table = soup.find('table', {'id': 'ts'})

    # Extract cities' data
    if table:
        city_data = []
        rows = table.find('tbody').find_all('tr')

        name_idx = 3 if province_name != 'Fujian' else 2
        popu_idx = 7 if province_name != 'Fujian' else 6

        for row in rows:
            cells = row.find_all('td')
            if len(cells) >= 8:  # Ensure enough columns in the row
                city_name = cells[name_idx].text.strip()
                city_population = int(cells[popu_idx].text.strip().replace(',', '').replace('.', '')) 
                city_data.append((city_name, city_population))

        # Sort by population in descending order
        city_data.sort(key=lambda x: x[1], reverse=True)

        city_names = [city[0] for city in city_data]
        city_populations = [city[1] for city in city_data]

        return city_names, city_populations
    else:
        print(f"No cities table found for {province_name}.")
        return [], []

# Function to scrape data for a list of provinces and calculate HHI (Online)
def scrape_and_calculate_hhi(provinces):
    """
    Scrapes the city population data for each province and calculates the HHI.
    Returns a list of dictionaries with province names, city populations, and corresponding HHI values.
    """
    hhi_data = []
    city_data = []  # To store city-level data (name and population)

    for province_name in provinces:
        print(f"Scraping data for {province_name}...")
        try:
            city_names, city_populations = get_all_cities(province_name)
            if city_populations:  # Ensure we have cities data
                hhi_value = calculate_hhi(city_populations)
                hhi_data.append({'Province': province_name, 'HHI': hhi_value})
                # Append city data for each province
                for city, pop in zip(city_names, city_populations):
                    city_data.append({'Province': province_name, 'City': city, 'Population': pop})
            else:
                print(f"Could not find the population data for {province_name}. Skipping...")
        except Exception as e:
            print(f"Error with {province_name}: {e}")

    return hhi_data, city_data

# Function to calculate HHI from a local CSV file
def calculate_hhi_from_local(file_path):
    """
    Reads city population data from a local CSV file and calculates HHI for each province.
    Returns a list of dictionaries with province names, city populations, and HHI values.
    """
    try:
        # Load data
        data = pd.read_csv(file_path)
        hhi_data = []
        city_data = []

        # Process each province
        for province in data['Province'].unique():
            province_data = data[data['Province'] == province]
            # Sort by population in descending order
            province_data = province_data.sort_values(by='Population', ascending=False)

            # Select top 10 cities (or fewer if less than 10 exist)
            top_cities = province_data.head(TOP_N)

            # Extract populations and city names
            cities = top_cities['Population'].tolist()
            city_names = top_cities['City'].tolist()

            # Calculate HHI
            hhi_value = calculate_hhi(cities)

            # Append results
            hhi_data.append({'Province': province, 'HHI': hhi_value, 'Top': len(cities)})
            for city, pop in zip(city_names, cities):
                city_data.append({'Province': province, 'City': city, 'Population': pop})

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
        hhi_df = hhi_df.sort_values(by="HHI", ascending=True).reset_index(drop=True)
        print("HHI DataFrame after sorting: ")
        print(hhi_df.to_string())

        # Save HHI data to CSV
        hhi_df.to_csv(f'province_hhi_data.csv', index=False)
        print("HHI data saved to 'province_hhi_data.csv'.")

    if city_data:
        # Convert city-level data to a DataFrame with explicit column order: 'Province', 'City', 'Population'
        city_df = pd.DataFrame(city_data, columns=['Province', 'City', 'Population'])
        # Save city-level data to CSV with the correct column order
        city_df.to_csv('province_population_data.csv', index=False)
        print("City population data saved to 'province_population_data.csv'.")

# Main function to decide data source and calculate HHI
def main(provinces, use_local=True, local_file_path='province_population_curated.csv'):
    """Main function to choose data source and calculate HHI."""
    if use_local:
        print("Using local data...")
        hhi_data, city_data = calculate_hhi_from_local(local_file_path)
    else:
        print("Using online data...")
        hhi_data, city_data = scrape_and_calculate_hhi(provinces)

    # Display and save the collected data
    display_and_save_data(hhi_data, city_data)

# List of provinces in China
provinces = [
    # 'Beijing', 'Shanghai', 'Tianjin', 
    'Anhui', 'Chongqing', 'Fujian', 'Gansu', 'Guangdong', 'Guangxi', 'Guizhou', 
    'Hainan', 'Hebei', 'Heilongjiang', 'Henan', 'Hubei', 'Hunan', 'Jiangsu', 'Jiangxi', 
    'Jilin', 'Liaoning', 'Neimenggu', 'Ningxia', 'Qinghai', 'Shaanxi', 'Shandong', 
    'Shanxi', 'Sichuan', 'Xizang', 'Xinjiang', 'Yunnan', 'Zhejiang', 
    'Taiwan',
    # 'Hong Kong', 'Macau', 
]

TOP_N = 5

# Run the main function
main(provinces)
