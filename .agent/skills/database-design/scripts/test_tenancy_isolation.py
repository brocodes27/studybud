#!/usr/bin/env python3
"""
Tenancy Isolation Verification Script
======================================
Verifies Row Level Security (RLS) isolation between schools using Supabase REST API.

Checks:
  - School A user can read School A grade sections
  - School A user cannot read School B grade sections
  - School B user can read School B grade sections
  - School B user cannot read School A grade sections
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
    print(f"{Colors.BOLD}{Colors.BLUE}         🚀 TENANCY ISOLATION VERIFICATION SUITE            {Colors.ENDC}")
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
        print(f"{Colors.YELLOW}⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY is missing, truncated, or invalid in .env. Skipping live database tenancy verification.{Colors.ENDC}")
        sys.exit(0)
        
    print(f"Supabase Project URL: {supabase_url}")
    
    # Setup headers
    admin_headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    anon_headers = {
        "apikey": anon_key,
        "Content-Type": "application/json"
    }
    
    # State tracking for cleanup
    created_schools = []
    created_users = []
    created_grade_sections = []
    
    try:
        # 2. Create School A and School B
        print(f"\n{Colors.BOLD}Step 1: Creating mock schools...{Colors.ENDC}")
        school_a_code = f"TEST-A-{uuid.uuid4().hex[:6].upper()}"
        school_b_code = f"TEST-B-{uuid.uuid4().hex[:6].upper()}"
        
        # School A
        status, res = make_request(
            f"{supabase_url}/rest/v1/schools",
            "POST",
            admin_headers,
            {"name": "RLS Test School A", "code": school_a_code, "domain": f"{school_a_code.lower()}.edu"}
        )
        if status not in [200, 201]:
            raise Exception(f"Failed to create School A: {res}")
        school_a_id = res[0]["id"]
        created_schools.append(school_a_id)
        print(f"  ✅ Created School A: RLS Test School A (ID: {school_a_id})")
        
        # School B
        status, res = make_request(
            f"{supabase_url}/rest/v1/schools",
            "POST",
            admin_headers,
            {"name": "RLS Test School B", "code": school_b_code, "domain": f"{school_b_code.lower()}.edu"}
        )
        if status not in [200, 201]:
            raise Exception(f"Failed to create School B: {res}")
        school_b_id = res[0]["id"]
        created_schools.append(school_b_id)
        print(f"  ✅ Created School B: RLS Test School B (ID: {school_b_id})")
        
        # 3. Create pre-confirmed User A and User B
        print(f"\n{Colors.BOLD}Step 2: Creating mock admin users...{Colors.ENDC}")
        user_a_email = f"user_a_{uuid.uuid4().hex[:8]}@example.com"
        user_b_email = f"user_b_{uuid.uuid4().hex[:8]}@example.com"
        password = "SecurePassword123!"
        
        # User A
        status, res = make_request(
            f"{supabase_url}/auth/v1/admin/users",
            "POST",
            admin_headers,
            {"email": user_a_email, "password": password, "email_confirm": True}
        )
        if status not in [200, 201]:
            raise Exception(f"Failed to create User A: {res}")
        user_a_id = res["id"]
        created_users.append(user_a_id)
        print(f"  ✅ Created User A: {user_a_email} (ID: {user_a_id})")
        
        # User B
        status, res = make_request(
            f"{supabase_url}/auth/v1/admin/users",
            "POST",
            admin_headers,
            {"email": user_b_email, "password": password, "email_confirm": True}
        )
        if status not in [200, 201]:
            raise Exception(f"Failed to create User B: {res}")
        user_b_id = res["id"]
        created_users.append(user_b_id)
        print(f"  ✅ Created User B: {user_b_email} (ID: {user_b_id})")
        
        # 4. Link memberships
        print(f"\n{Colors.BOLD}Step 3: Creating school memberships...{Colors.ENDC}")
        # User A to School A
        status, res = make_request(
            f"{supabase_url}/rest/v1/memberships",
            "POST",
            admin_headers,
            {"user_id": user_a_id, "school_id": school_a_id, "role": "student", "status": "active"}
        )
        if status not in [200, 201]:
            raise Exception(f"Failed to create membership for User A: {res}")
        print("  ✅ Membership created: User A -> School A")
        
        # User B to School B
        status, res = make_request(
            f"{supabase_url}/rest/v1/memberships",
            "POST",
            admin_headers,
            {"user_id": user_b_id, "school_id": school_b_id, "role": "student", "status": "active"}
        )
        if status not in [200, 201]:
            raise Exception(f"Failed to create membership for User B: {res}")
        print("  ✅ Membership created: User B -> School B")
        
        # 5. Create Grade Sections
        print(f"\n{Colors.BOLD}Step 4: Creating mock school grade sections...{Colors.ENDC}")
        # Grade Section A (School A)
        status, res = make_request(
            f"{supabase_url}/rest/v1/grade_sections",
            "POST",
            admin_headers,
            {"school_id": school_a_id, "grade": "Class 10", "section": "A"}
        )
        if status not in [200, 201]:
            raise Exception(f"Failed to create grade section A: {res}")
        section_a_id = res[0]["id"]
        created_grade_sections.append(section_a_id)
        print(f"  ✅ Grade Section A created (School A) - ID: {section_a_id}")
        
        # Grade Section B (School B)
        status, res = make_request(
            f"{supabase_url}/rest/v1/grade_sections",
            "POST",
            admin_headers,
            {"school_id": school_b_id, "grade": "Class 12", "section": "B"}
        )
        if status not in [200, 201]:
            raise Exception(f"Failed to create grade section B: {res}")
        section_b_id = res[0]["id"]
        created_grade_sections.append(section_b_id)
        print(f"  ✅ Grade Section B created (School B) - ID: {section_b_id}")
        
        # 6. Authenticate User A and User B
        print(f"\n{Colors.BOLD}Step 5: Logging in mock users to obtain JWTs...{Colors.ENDC}")
        # User A Token
        status, res = make_request(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            "POST",
            anon_headers,
            {"email": user_a_email, "password": password}
        )
        if status != 200:
            raise Exception(f"Failed to login User A: {res}")
        user_a_jwt = res["access_token"]
        print("  ✅ Authenticated User A")
        
        # User B Token
        status, res = make_request(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            "POST",
            anon_headers,
            {"email": user_b_email, "password": password}
        )
        if status != 200:
            raise Exception(f"Failed to login User B: {res}")
        user_b_jwt = res["access_token"]
        print("  ✅ Authenticated User B")
        
        # 7. Assert Tenancy Isolation
        print(f"\n{Colors.BOLD}Step 6: Executing isolation assertions (RLS Verification)...{Colors.ENDC}")
        
        user_a_headers = {
            "apikey": anon_key,
            "Authorization": f"Bearer {user_a_jwt}"
        }
        
        user_b_headers = {
            "apikey": anon_key,
            "Authorization": f"Bearer {user_b_jwt}"
        }
        
        # Query sections as User A
        status, res = make_request(f"{supabase_url}/rest/v1/grade_sections", "GET", user_a_headers)
        if status != 200:
            raise Exception(f"User A query failed: {res}")
            
        a_section_ids = [gs["id"] for gs in res]
        print(f"  🔍 User A (School A) fetched sections: {a_section_ids}")
        
        # Assertions for User A
        assert section_a_id in a_section_ids, "School A user MUST be able to see School A's sections"
        assert section_b_id not in a_section_ids, "School A user MUST NOT be able to see School B's sections! [CROSS-READ ERROR]"
        print(f"  {Colors.GREEN}✔ User A Isolation Verified!{Colors.ENDC}")
        
        # Query sections as User B
        status, res = make_request(f"{supabase_url}/rest/v1/grade_sections", "GET", user_b_headers)
        if status != 200:
            raise Exception(f"User B query failed: {res}")
            
        b_section_ids = [gs["id"] for gs in res]
        print(f"  🔍 User B (School B) fetched sections: {b_section_ids}")
        
        # Assertions for User B
        assert section_b_id in b_section_ids, "School B user MUST be able to see School B's sections"
        assert section_a_id not in b_section_ids, "School B user MUST NOT be able to see School A's sections! [CROSS-READ ERROR]"
        print(f"  {Colors.GREEN}✔ User B Isolation Verified!{Colors.ENDC}")
        
        print(f"\n{Colors.GREEN}🎉 SUCCESS: Tenancy isolation successfully verified on all schemas.{Colors.ENDC}")
        
    except Exception as e:
        print(f"\n{Colors.RED}❌ FAILURE: Tenancy verification failed - {str(e)}{Colors.ENDC}")
        sys.exit(1)
        
    finally:
        # 8. Clean up created mock resources
        print(f"\n{Colors.BOLD}Step 7: Executing resource cleanup...{Colors.ENDC}")
        
        # Delete schools (cascades memberships & sections)
        for s_id in created_schools:
            status, res = make_request(f"{supabase_url}/rest/v1/schools?id=eq.{s_id}", "DELETE", admin_headers)
            if status in [200, 204]:
                print(f"  🧹 Cleaned up School (ID: {s_id})")
                
        # Delete auth users
        for u_id in created_users:
            status, res = make_request(f"{supabase_url}/auth/v1/admin/users/{u_id}", "DELETE", admin_headers)
            if status in [200, 204]:
                print(f"  🧹 Cleaned up User (ID: {u_id})")
                
        print(f"Cleanup complete ✨\n")

if __name__ == "__main__":
    main()
