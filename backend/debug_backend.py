
import os
import sys
import traceback

# Add current dir to sys.path
sys.path.append(os.path.abspath('.'))

try:
    from main import get_dataset_profile, update_schema_info, active_schema, active_table, client
    
    print("--- Initial State ---")
    print(f"active_table: {active_table}")
    print(f"active_schema: {active_schema}")
    print(f"client: {client}")
    
    print("\n--- Testing update_schema_info ---")
    update_schema_info()
    print("Success")
    
    print("\n--- Testing get_dataset_profile ---")
    profile = get_dataset_profile()
    print("Profile keys:", list(profile.keys()))
    print("Profile row_count:", profile.get("row_count"))
    
    print("\n--- Diagnostic Check Complete ---")

except Exception as e:
    print("\n--- ERROR DETECTED ---")
    traceback.print_exc()
    sys.exit(1)
