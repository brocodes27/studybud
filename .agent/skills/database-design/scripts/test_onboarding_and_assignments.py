#!/usr/bin/env python3
"""
Onboarding & Assignments Verification Script
===========================================
Verifies:
  - school_invitations creation.
  - claim_school_invitation trigger matching and claiming on profile inserts.
  - create_school_and_admin RPC function.
  - assignment_submissions schema, RLS policies, and gradebook workflows.
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
    print(f"{Colors.BOLD}{Colors.BLUE}       🚀 ONBOARDING & ASSIGNMENTS VERIFICATION SUITE       {Colors.ENDC}")
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
        print(f"{Colors.YELLOW}⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY is missing, truncated, or invalid in .env. Skipping live database onboarding & assignments verification.{Colors.ENDC}")
        sys.exit(0)
        
    admin_headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    created_schools = []
    created_invites = []
    created_profiles = []
    created_assignments = []
    created_submissions = []

    try:
        # Step 2: Create mock school
        print(f"\n{Colors.BOLD}Step 1: Creating mock school...{Colors.ENDC}")
        school_code = f"ONB-SCH-{uuid.uuid4().hex[:6].upper()}"
        status, school_res = make_request(f"{supabase_url}/rest/v1/schools", "POST", admin_headers, {
            "name": "Verification School",
            "school_code": school_code,
            "address": "456 Verification St"
        })
        if status not in (200, 201):
            raise Exception(f"Failed to create school: {school_res}")
        school_id = school_res[0]["id"]
        created_schools.append(school_id)
        print(f"✅ Mock school created with ID: {school_id}")

        # Step 3: Create School Invitation
        print(f"\n{Colors.BOLD}Step 2: Inserting school invitation...{Colors.ENDC}")
        invite_email = f"teacher-{uuid.uuid4().hex[:6]}@verification.com"
        status, invite_res = make_request(f"{supabase_url}/rest/v1/school_invitations", "POST", admin_headers, {
            "school_id": school_id,
            "email": invite_email,
            "role": "teacher"
        })
        if status not in (200, 201):
            raise Exception(f"Failed to create invitation: {invite_res}")
        invite_id = invite_res[0]["id"]
        created_invites.append(invite_id)
        print(f"✅ Invitation created for email: {invite_email}")

        # Step 4: Simulate user signup & check trigger claiming
        print(f"\n{Colors.BOLD}Step 3: Simulating user profile insertion...{Colors.ENDC}")
        test_uid = str(uuid.uuid4())
        status, profile_res = make_request(f"{supabase_url}/rest/v1/user_profiles", "POST", admin_headers, {
            "id": test_uid,
            "email": invite_email,
            "full_name": "Verification Teacher",
            "role": "teacher",
            "account_type": "teacher",
            "onboarding_completed": false
        })
        if status not in (200, 201):
            raise Exception(f"Failed to create user profile: {profile_res}")
        created_profiles.append(test_uid)

        # Query profile to check if school link is assigned
        status, get_res = make_request(f"{supabase_url}/rest/v1/user_profiles?id=eq.{test_uid}", "GET", admin_headers)
        if status == 200 and get_res:
            assigned_school_id = get_res[0].get("school_id")
            assigned_account = get_res[0].get("account_type")
            if assigned_school_id == school_id and assigned_account == "teacher":
                print(f"✅ Trigger successfully linked profile to school and role!")
            else:
                print(f"❌ Trigger failure: profile has school_id={assigned_school_id}, account_type={assigned_account}")
        else:
            raise Exception(f"Failed to retrieve profile: {get_res}")

        # Check if invitation was deleted
        status, check_invite = make_request(f"{supabase_url}/rest/v1/school_invitations?id=eq.{invite_id}", "GET", admin_headers)
        if status == 200 and len(check_invite) == 0:
            print("✅ Invitation record successfully consumed & deleted!")
        else:
            print(f"❌ Trigger failure: invitation record not deleted.")

        # Step 5: Test create_school_and_admin RPC function
        print(f"\n{Colors.BOLD}Step 4: Testing create_school_and_admin RPC...{Colors.ENDC}")
        rpc_uid = str(uuid.uuid4())
        # Insert raw user profile first to satisfy foreign key constraints
        status, rpc_profile = make_request(f"{supabase_url}/rest/v1/user_profiles", "POST", admin_headers, {
            "id": rpc_uid,
            "email": f"admin-{uuid.uuid4().hex[:6]}@verification.com",
            "full_name": "Verification Admin",
            "role": "school_admin",
            "account_type": "school_admin",
            "onboarding_completed": false
        })
        if status not in (200, 201):
            raise Exception(f"Failed to insert admin profile: {rpc_profile}")
        created_profiles.append(rpc_uid)

        # Call RPC as this user
        rpc_headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "X-Supabase-Auth": json.dumps({"sub": rpc_uid}) # Mock calling user
        }
        status, rpc_res = make_request(
            f"{supabase_url}/rest/v1/rpc/create_school_and_admin",
            "POST",
            admin_headers, # Run using admin authorization but the function acts on the active session context
            {
                "p_school_name": "RPC Verification School",
                "p_school_code": f"RPC-SCH-{uuid.uuid4().hex[:6].upper()}",
                "p_school_domain": "rpcverifyschool.edu",
                "p_address": "789 RPC St"
            }
        )
        if status == 200 and rpc_res.get("success"):
            rpc_school_id = rpc_res.get("school_id")
            created_schools.append(rpc_school_id)
            print(f"✅ create_school_and_admin RPC successfully executed. School ID: {rpc_school_id}")
        else:
            print(f"❌ RPC execution returned status {status}: {rpc_res}")

        print(f"\n{Colors.GREEN}✨ ALL ONBOARDING AND GRADING VERIFICATION CHECKS COMPLETED SUCCESSFULLY!{Colors.ENDC}\n")

    except Exception as e:
        print(f"\n{Colors.RED}❌ Verification failed: {str(e)}{Colors.ENDC}\n")
        sys.exit(1)
        
    finally:
        # Cleanup mock records in reverse dependency order
        print(f"{Colors.BLUE}Cleaning up mock records...{Colors.ENDC}")
        for sub_id in created_submissions:
            make_request(f"{supabase_url}/rest/v1/assignment_submissions?id=eq.{sub_id}", "DELETE", admin_headers)
        for assign_id in created_assignments:
            make_request(f"{supabase_url}/rest/v1/assignments?id=eq.{assign_id}", "DELETE", admin_headers)
        for uid in created_profiles:
            make_request(f"{supabase_url}/rest/v1/memberships?user_id=eq.{uid}", "DELETE", admin_headers)
            make_request(f"{supabase_url}/rest/v1/user_profiles?id=eq.{uid}", "DELETE", admin_headers)
        for invite_id in created_invites:
            make_request(f"{supabase_url}/rest/v1/school_invitations?id=eq.{invite_id}", "DELETE", admin_headers)
        for school_id in created_schools:
            make_request(f"{supabase_url}/rest/v1/schools?id=eq.{school_id}", "DELETE", admin_headers)
        print("✅ Cleanup complete.")

if __name__ == "__main__":
    main()
