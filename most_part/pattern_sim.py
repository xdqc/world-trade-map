import random
from collections import Counter, namedtuple

# Define the trading partners
# partners = ['US', 'EU', 'CN']
partners = [1,2,3,]

# Use a named tuple for better code readability
TradeData = namedtuple('TradeData', ['imports', 'exports', 'total', 'deficit', 'surplus'])

def simulate_one_trial():
    """
    Simulates one single trial of trade between the three partners and
    determines the winner for each of the five categories.
    """
    trade_values = {}
    for partner in partners:
        imports = random.uniform(10, 100)
        exports = random.uniform(10, 100)
        
        total = imports + exports
        deficit = imports - exports
        surplus = exports - imports
        
        trade_values[partner] = TradeData(imports, exports, total, deficit, surplus)

    # Find the winner for each category
    def find_winner(key):
        # Handle potential ties
        winner = max(partners, key=lambda p: getattr(trade_values[p], key))
        return winner

    total_winner = find_winner('total')
    import_winner = find_winner('imports')
    export_winner = find_winner('exports')
    deficit_winner = find_winner('deficit')
    surplus_winner = find_winner('surplus')

    # Return the pattern as a tuple for easy counting
    return (total_winner, import_winner, export_winner, deficit_winner, surplus_winner)

def run_simulation(num_trials=1000000):
    """
    Runs the simulation for a large number of trials and counts the frequency
    of each unique pattern.
    
    Args:
        num_trials (int): The number of trials to run.
    """
    patterns = Counter()
    for _ in range(num_trials):
        pattern = simulate_one_trial()
        patterns[pattern] += 1
    
    # Sort the results by frequency and print them
    print(f"Simulation of {num_trials:,} trials complete.")
    print("----------------------------------------------------------------------")
    print("Most Frequent Patterns (Total:Import:Export:Deficit:Surplus)")
    print("----------------------------------------------------------------------")
    
    common_patterns = patterns.most_common()
    # common_patterns.sort(key=lambda tup: tup[0])
    for pattern, count in common_patterns:
        percentage = (count / num_trials) * 100
        print(f"Pattern: {pattern} | Occurrences: {count:,} | Percentage: {percentage:.2f}%")

    print("\n----------------------------------------------------------------------")
    print(f"Total Unique Feasible Patterns Found: {len(patterns)}")

if __name__ == "__main__":
    run_simulation()
