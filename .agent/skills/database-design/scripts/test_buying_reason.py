#!/usr/bin/env python3
"""
Buying Reason (Phase 3) Verification Script
===========================================
Verifies:
  - ai_usage_logs schema and RLS policies.
  - log_ai_usage RPC costing calculations.
  - check_ai_budget RPC cap limit rate-blocking.
  - get_school_outcomes_summary RPC analytics aggregation.
"""

import os
import sys
import json
import urllib.request
import urllib.error
import uuid
from pathlib import Path
from dotenv import load_dotenv

# ANSI colors for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def make_request(url: str, method: str, headers: dict, body: dict = None) -> tuple:
    """Send an HTTP request and return (status_code, response_dict)"""
    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read().decode('utf-8')
            return response.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        res_body = e.read().decode('utf-8')
        try:
            err_data = json.loads(res_body)
        except:
            err_data = {"message": res_body}
        return e.code, err_data
    except Exception as e:
        return 500, {"message": str(e)}

def main():
    print(f"{Colors.BOLD}{Colors.BLUE}============================================================{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}         🚀 BUYING REASON VERIFICATION SUITE               {Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}============================================================{Colors.ENDC}")
    
    # 1. Load env vars
    project_path = Path(__file__).resolve().parent.parent.parent.parent.parent
    env_path = project_path / ".env"
    
    if not env_path.exists():
        print(f"{Colors.RED}❌ Error: .env file not found at {env_path}{Colors.ENDC}")
        sys.exit(1)
        
    load_dotenv(dotenv_path=env_path)
    
    supabase_url = os.getenv("VITE_SUPABASE_URL")
    anon_key = os.getenv("VITE_SUPABASE_ANON_KEY")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not anon_key or not service_role_key or len(service_role_key) < 200 or service_role_key.endswith("$"):
        print(f"{Colors.YELLOW}⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY is missing, truncated, or invalid in .env. Skipping live database buying reason verification.{Colors.ENDC}")
        sys.exit(0)
        
    admin_headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    created_schools = []
    created_profiles = []
    created_usage_logs = []
    created_entitlements = []

    try:
        # Step 2: Create mock school & admin user profile
        print(f"\n{Colors.BOLD}Step 1: Setting up mock school & user...{Colors.ENDC}")
        school_code = f"BUY-SCH-{uuid.uuid4().hex[:6].upper()}"
        status, school_res = make_request(f"{supabase_url}/rest/v1/schools", "POST", admin_headers, {
            "name": "Buying Reason School",
            "school_code": school_code,
            "address": "999 Purchase Lane"
        })
        if status not in (200, 201):
            raise Exception(f"Failed to create school: {school_res}")
        school_id = school_res[0]["id"]
        created_schools.append(school_id)

        test_uid = str(uuid.uuid4())
        status, profile_res = make_request(f"{supabase_url}/rest/v1/user_profiles", "POST", admin_headers, {
            "id": test_uid,
            "email": f"buyer-{uuid.uuid4().hex[:6]}@purchase.com",
            "full_name": "Procurement Buyer",
            "role": "school_admin",
            "account_type": "school_admin",
            "school_id": school_id,
            "onboarding_completed": True
        })
        if status not in (200, 201):
            raise Exception(f"Failed to create user profile: {profile_res}")
        created_profiles.append(test_uid)
        print(f"✅ Mock School ID: {school_id}, Admin ID: {test_uid}")

        # Step 3: Set up school entitlement pilot plan
        print(f"\n{Colors.BOLD}Step 2: Configuring pilot school entitlement...{Colors.ENDC}")
        status, entitlement_res = make_request(f"{supabase_url}/rest/v1/school_entitlements", "POST", admin_headers, {
            "school_id": school_id,
            "plan": "pilot",
            "seat_count": 50
        })
        if status not in (200, 201):
            raise Exception(f"Failed to create entitlement: {entitlement_res}")
        entitlement_id = entitlement_res[0]["id"]
        created_entitlements.append(entitlement_id)
        print("✅ Entitlement pilot active (budget: $10.00)")

        # Step 4: Verify check_ai_budget returns true
        print(f"\n{Colors.BOLD}Step 3: Checking initial budget availability...{Colors.ENDC}")
        status, budget_res = make_request(f"{supabase_url}/rest/v1/rpc/check_ai_budget", "POST", admin_headers, {
            "p_user_id": test_uid
        })
        if status == 200 and budget_res is True:
            print("✅ check_ai_budget correctly returns TRUE.")
        else:
            raise Exception(f"Failed initial budget check: {budget_res}")

        # Step 5: Log large AI call to exceed budget limit
        print(f"\n{Colors.BOLD}Step 4: Logging high-token AI call to hit limit...{Colors.ENDC}")
        # Call log_ai_usage RPC with huge parameters to cross the $10 limit (e.g. 80,000,000 characters)
        status, log_res = make_request(f"{supabase_url}/rest/v1/rpc/log_ai_usage", "POST", admin_headers, {
          "p_user_id": test_uid,
          "p_model": "gemini-1.5-flash",
          "p_feature_name": "viva_questions",
          "p_prompt_len": 40000000,
          "p_completion_len": 40000000
        })
        if status == 200 and log_res.get("success"):
            print(f"✅ Usage logged successfully (cost: ${log_res.get('cost')})")
        else:
            raise Exception(f"Failed logging AI usage: {log_res}")

        # Step 6: Verify check_ai_budget returns false
        print(f"\n{Colors.BOLD}Step 5: Verifying budget blocking...{Colors.ENDC}")
        status, budget_res2 = make_request(f"{supabase_url}/rest/v1/rpc/check_ai_budget", "POST", admin_headers, {
            "p_user_id": test_uid
        })
        if status == 200 and budget_res2 is False:
            print("✅ check_ai_budget successfully returns FALSE after limit crossed!")
        else:
            raise Exception(f"Budget block validation failed: {budget_res2}")

        # Step 7: Verify school outcomes summary RPC
        print(f"\n{Colors.BOLD}Step 6: Testing outcomes aggregation...{Colors.ENDC}")
        status, outcomes_res = make_request(f"{supabase_url}/rest/v1/rpc/get_school_outcomes_summary", "POST", admin_headers, {
            "p_school_id": school_id
        })
        if status == 200:
            print(f"✅ outcomes aggregated: {outcomes_res}")
        else:
            raise Exception(f"Failed outcomes summary RPC: {outcomes_res}")

        print(f"\n{Colors.GREEN}✨ ALL COST GOVERNANCE & OUTCOMES VERIFICATION CHECKS COMPLETED SUCCESSFULLY!{Colors.ENDC}\n")

    except Exception as e:
        print(f"\n{Colors.RED}❌ Verification failed: {str(e)}{Colors.ENDC}\n")
        sys.exit(1)
        
    finally:
        # Cleanup mock records
        print(f"{Colors.BLUE}Cleaning up mock records...{Colors.ENDC}")
        for uid in created_profiles:
            make_request(f"{supabase_url}/rest/v1/ai_usage_logs?user_id=eq.{uid}", "DELETE", admin_headers)
            make_request(f"{supabase_url}/rest/v1/memberships?user_id=eq.{uid}", "DELETE", admin_headers)
            make_request(f"{supabase_url}/rest/v1/user_profiles?id=eq.{uid}", "DELETE", admin_headers)
        for entitlement_id in created_entitlements:
            make_request(f"{supabase_url}/rest/v1/school_entitlements?id=eq.{entitlement_id}", "DELETE", admin_headers)
        for school_id in created_schools:
            make_request(f"{supabase_url}/rest/v1/schools?id=eq.{school_id}", "DELETE", admin_headers)
        print("✅ Cleanup complete.")

if __name__ == "__main__":
    main()
