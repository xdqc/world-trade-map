import numpy as np
from collections import Counter

# Define trading partners
partners = np.array([
    # 1,2,3,4,5,6,7,8,9
    'USA  ','EU   ','China',
                     ])
n = len(partners)

def run_simulation(num_trials=6_000_000):
    """
    Vectorized simulation using NumPy for speed.
    """
    # Generate random imports and exports for all trials and partners
    imports = np.random.pareto( 1000, size=(num_trials, len(partners)))
    exports = np.random.pareto( 1000, size=(num_trials, len(partners)))
    
    totals = imports + exports
    deficits = imports - exports
    surpluses = -deficits   # avoid recomputing
    
    # Get argmax winners for each category
    total_winners   = partners[np.argmax(totals, axis=1)]
    import_winners  = partners[np.argmax(imports, axis=1)]
    export_winners  = partners[np.argmax(exports, axis=1)]
    deficit_winners = partners[np.argmax(deficits, axis=1)]
    surplus_winners = partners[np.argmax(surpluses, axis=1)]
    
    # Stack into patterns
    patterns = np.stack(
        (total_winners, import_winners, export_winners, deficit_winners, surplus_winners),
        axis=1
    )
    
    # Convert to tuples for Counter
    pattern_tuples = list(map(tuple, patterns))
    counts = Counter(pattern_tuples)
    
    # Sort both ways
    most_common = counts.most_common(10)
    least_common = sorted(counts.items(), key=lambda x: x[1])[:10]
    ordered = sorted(counts.items(), key=lambda x: x[0])

    # Display results
    print(f"Simulation of {num_trials:,} trials complete.")
    print("----------------------------------------------------------------------")
    print("Top 10 Most Frequent Patterns (Total:Import:Export:Deficit:Surplus)")
    print("----------------------------------------------------------------------")
    
    for pattern, count in most_common:
        percentage = (count / num_trials) * 100
        print(f"Pattern: {pattern} | Occurrences: {count:,} | Percentage: {percentage:.4f}%")
    
    print("\n----------------------------------------------------------------------")
    print("Top 10 Least Frequent Patterns")
    print("----------------------------------------------------------------------")
    
    for pattern, count in least_common:
        percentage = (count / num_trials) * 100
        print(f"Pattern: {pattern} | Occurrences: {count:,} | Percentage: {percentage:.6f}%")
    
    print("\n----------------------------------------------------------------------")
    print("Top 1000 Ordered Patterns")
    print("----------------------------------------------------------------------")
    
    for pattern, count in ordered[:1000]:
        percentage = (count / num_trials) * 1000
        print(*pattern, f"\t: {percentage:>8.4f}")

    
    print("\n----------------------------------------------------------------------")
    print(f"Total Unique Feasible Patterns Found: {len(counts)}")
    print(f"Calculate total number of {n} patterns: {8*n - 20*n**2 + 17*n**3 - 6*n**4 + n**5}")
if __name__ == "__main__":
    run_simulation()

