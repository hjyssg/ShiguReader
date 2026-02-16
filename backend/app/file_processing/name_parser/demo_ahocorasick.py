#!/usr/bin/env python3
"""Demo script to show ahocorasick performance benefits."""

import time
from pathlib import Path

# Test data
test_filenames = [
    "[夏美酱] Photoset 001.zip",
    "(Natsumi) Summer Collection.zip",  
    "[なつみ] Random Photos (Character).zip",
    "[Momo Rina モモリナ] Professional Shoot.zip",
    "Unknown Coser Photos.zip",
    "[夏美酱] (Natsumi) Mix.zip",  # Contains both name and alias
]

def demo_lookup_vs_batch():
    """Compare single lookup vs batch matching."""
    try:
        from app.file_processing.name_parser.coser_db import lookup_coser, find_cosers_in_text, HAS_AHOCORASICK
    except ImportError:
        print("Error: Cannot import coser_db. Make sure you're in the correct directory.")
        return
    
    print("=" * 60)
    print("Coser Database Performance Demo")
    print("=" * 60)
    
    if not HAS_AHOCORASICK:
        print("\n⚠️  WARNING: pyahocorasick not installed!")
        print("   Install it with: pip install pyahocorasick")
        print("   For now, only showing basic lookup functionality.\n")
    else:
        print("\n✓ pyahocorasick is installed\n")
    
    print(f"Testing with {len(test_filenames)} filenames:\n")
    
    for filename in test_filenames:
        print(f"  - {filename}")
    
    print("\n" + "-" * 60)
    print("Method 1: Manual loop with lookup_coser()")
    print("-" * 60)
    
    # Method 1: Loop through and extract manually
    start = time.time()
    for filename in test_filenames:
        # Simplified extraction (just checking for names)
        result = lookup_coser(filename)
        print(f"  {filename[:40]:40} → Single lookup: {result}")
    elapsed_loop = time.time() - start
    print(f"\nTime: {elapsed_loop:.4f}s")
    
    if HAS_AHOCORASICK:
        print("\n" + "-" * 60)
        print("Method 2: Aho-Corasick batch matching")
        print("-" * 60)
        
        # Method 2: Use Aho-Corasick
        start = time.time()
        for filename in test_filenames:
            cosers = find_cosers_in_text(filename)
            print(f"  {filename[:40]:40} → Found: {cosers}")
        elapsed_batch = time.time() - start
        print(f"\nTime: {elapsed_batch:.4f}s")
        
        if elapsed_loop > 0:
            speedup = elapsed_loop / elapsed_batch
            print(f"\n🚀 Speedup: {speedup:.2f}x faster with Aho-Corasick!")
    
    print("\n" + "=" * 60)
    print("Key Advantages of Aho-Corasick:")
    print("=" * 60)
    print("  1. Finds ALL matching names in a single pass")
    print("  2. Handles overlapping matches automatically")
    print("  3. Scales well with database size (289 cosers)")
    print("  4. Returns main names (aliases auto-resolved)")
    print("=" * 60)


if __name__ == "__main__":
    demo_lookup_vs_batch()
