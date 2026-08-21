import React, { useState } from "react";
import {
  Mail,
  Lock,
  User,
  GraduationCap,
  BookOpen,
  ArrowRight,
  Loader2,
  Shield,
  Hash,
  Sparkles,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import { supabase } from "../lib/supabase";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  canSchoolPortalRoleSignUp,
  readSchoolPortalRole,
  type SchoolPortalRole,
} from "../lib/schoolAuth";

async function enrollStudentInClass(userId: string, classId: string) {
  // Try inserting with user_id
  const { error: err1 } = await supabase.from("class_members").insert({
    user_id: userId,
    class_id: classId,
  });
  if (!err1) return { success: true };

  // Fallback: try inserting with student_id
  const { error: err2 } = await supabase.from("class_members").insert({
    student_id: userId,
    class_id: classId,
  });
  if (!err2) return { success: true };

  console.error("Failed to enroll student:", err1, err2);
  throw new Error(err1.message || err2.message || "Failed to join class");
}

async function checkEnrollmentExists(userId: string, classId: string) {
  // Check with user_id first
  const { data: d1 } = await supabase
    .from("class_members")
    .select("id")
    .eq("user_id", userId)
    .eq("class_id", classId)
    .maybeSingle();
  if (d1) return true;

  // Fallback check with student_id
  const { data: d2 } = await supabase
    .from("class_members")
    .select("id")
    .eq("student_id", userId)
    .eq("class_id", classId)
    .maybeSingle();
  return !!d2;
}

export function Auth() {
  const [searchParams] = useSearchParams();
  const schoolPortal = searchParams.get("portal") === "schools";
  const studentPortal = searchParams.get("portal") === "students";
  const initialSchoolRole = readSchoolPortalRole(searchParams.get("role"));
  const [schoolRole, setSchoolRole] =
    useState<SchoolPortalRole>(initialSchoolRole);
  const [isSignUp, setIsSignUp] = useState(
    schoolPortal &&
      canSchoolPortalRoleSignUp(initialSchoolRole) &&
      searchParams.get("mode") === "signup",
  );
  const [userRole, setUserRole] = useState<"student" | "teacher">(
    schoolPortal ? "teacher" : "student",
  );
  const [loading, setLoading] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolLookupResult, setSchoolLookupResult] = useState<{
    id: string;
    name: string;
    code?: string;
  } | null>(null);
  const [classLookupResult, setClassLookupResult] = useState<{
    class_name: string;
    teacher_name: string;
    class_id: string;
  } | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
  });

  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLinkLoading, setEmailLinkLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle } = useAuth() as any;
  const { showToast } = useToast();
  const navigate = useNavigate();
  const leaderSignInOnly =
    schoolPortal && !canSchoolPortalRoleSignUp(schoolRole);
  const effectiveRole = schoolPortal
    ? "teacher"
    : studentPortal
      ? "student"
      : userRole;

  const selectSchoolRole = (role: SchoolPortalRole) => {
    setSchoolRole(role);
    setUserRole("teacher");
    setIsSignUp(false);
    resetClassLookup();
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (error: any) {
      showToast(error.message || "Google sign-in failed", "error");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLeaderEmailLink = async () => {
    const email = formData.email.trim().toLowerCase();
    if (!email) {
      showToast(
        "Enter the email address that was provisioned for you.",
        "error",
      );
      return;
    }

    setEmailLinkLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth?portal=schools`,
        },
      });
      if (error) throw error;
      showToast(
        "If this email has been provisioned, a secure sign-in link is on its way.",
        "success",
      );
    } catch (error: any) {
      showToast(
        error?.message || "The secure sign-in link could not be sent.",
        "error",
      );
    } finally {
      setEmailLinkLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const role = effectiveRole;
      const fullName = formData.full_name.trim();

      if (isSignUp) {
        if (leaderSignInOnly) {
          throw new Error(
            "Chain heads and principals must use provisioned sign-in access.",
          );
        }
        if (!fullName) {
          throw new Error("Please enter your full name.");
        }
        // A class code is optional for students. Consumer signup must not be
        // gated on belonging to a school; students who do have a code still
        // get enrolled in their class further down.
        if (role === "teacher" && isSignUp && !schoolLookupResult) {
          throw new Error(
            "Please enter your school code so we can link you to the right campus.",
          );
        }
        if (role === "teacher" && schoolLookupResult) {
          const { data: invited, error: inviteError } = await supabase.rpc(
            "validate_teacher_signup",
            {
              p_code: schoolLookupResult.code || schoolCode.trim(),
              p_email: formData.email.trim(),
            },
          );
          if (inviteError) throw inviteError;
          if (!invited) {
            throw new Error(
              "A school administrator must invite this email before teacher access is granted.",
            );
          }
        }

        const { error, data: signUpData } = await signUp(
          formData.email,
          formData.password,
          {
            full_name: fullName,
            role,
            school_code:
              role === "teacher"
                ? schoolLookupResult?.code || schoolCode.trim()
                : undefined,
          },
        );

        if (error) throw error;

        if (classLookupResult && signUpData?.user) {
          await enrollStudentInClass(
            signUpData.user.id,
            classLookupResult.class_id,
          );
        }

        if (role === "teacher" && schoolLookupResult && signUpData?.user) {
          if (signUpData.session) {
            const { error: joinError } = await supabase.rpc(
              "join_school_as_teacher",
              {
                p_code: schoolLookupResult.code || schoolCode.trim(),
              },
            );
            if (joinError) throw joinError;
          }
        }

        showToast(
          signUpData?.session
            ? "Account created!"
            : role === "teacher"
              ? "Check your email to confirm your account. Your selected school access is reserved."
              : "Check your email to confirm your account.",
          "success",
        );
        if (!signUpData?.session) return;
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) throw error;

        if (leaderSignInOnly) {
          const { error: claimError } = await supabase.rpc(
            "claim_pending_invitations",
          );
          if (claimError && claimError.code !== "PGRST202") throw claimError;
        }

        if (effectiveRole === "teacher" && schoolLookupResult) {
          const { error: joinError } = await supabase.rpc(
            "join_school_as_teacher",
            {
              p_code: schoolLookupResult.code || schoolCode.trim(),
            },
          );
          if (joinError) throw joinError;
        }

        if (classLookupResult) {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            const isEnrolled = await checkEnrollmentExists(
              userData.user.id,
              classLookupResult.class_id,
            );
            if (!isEnrolled) {
              await enrollStudentInClass(
                userData.user.id,
                classLookupResult.class_id,
              );
            }
          }
        }

        showToast("Welcome back!", "success");
      }

      navigate("/my-classes");
    } catch (error: any) {
      let msg = error.message;
      const isCredentialError =
        msg?.toLowerCase().includes("credential") ||
        msg?.toLowerCase().includes("invalid") ||
        msg?.toLowerCase().includes("email") ||
        error.status === 400 ||
        error.status === 401 ||
        error.statusCode === 400 ||
        error.statusCode === 401 ||
        error.status_code === 400 ||
        error.status_code === 401;

      if (!isSignUp && isCredentialError) {
        msg =
          "The email or password is incorrect, or this account has not been provisioned yet.";
      }
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClassCodeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCode.trim()) return;

    setCodeLoading(true);
    try {
      const { data, error } = await supabase
        .from("classes")
        .select(
          "id, name, teacher:user_profiles!classes_teacher_id_fkey(full_name), class_code",
        )
        .eq("class_code", classCode.trim().toUpperCase())
        .single();

      if (error || !data) {
        showToast("Invalid class code. Check and try again.", "error");
        setClassLookupResult(null);
        setCodeLoading(false);
        return;
      }

      // Supabase types this embedded relation as an array even though the
      // join returns at most one teacher.
      type TeacherRef = { full_name?: string | null };
      const teacher = data.teacher as TeacherRef | TeacherRef[] | null;

      setClassLookupResult({
        class_id: data.id,
        class_name: data.name,
        teacher_name:
          (Array.isArray(teacher) ? teacher[0]?.full_name : teacher?.full_name) || "Teacher",
      });
    } catch (err) {
      showToast("Error looking up class code.", "error");
      setClassLookupResult(null);
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSchoolCodeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolCode.trim()) return;

    setCodeLoading(true);
    try {
      const { data, error } = await supabase.rpc("lookup_school_by_code", {
        p_code: schoolCode.trim(),
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row?.id) {
        showToast(
          "Invalid school code. Ask your principal for the campus code.",
          "error",
        );
        setSchoolLookupResult(null);
        return;
      }
      setSchoolLookupResult({
        id: row.id,
        name: row.name,
        code: row.code || schoolCode.trim().toUpperCase(),
      });
    } catch {
      showToast("Error looking up school code.", "error");
      setSchoolLookupResult(null);
    } finally {
      setCodeLoading(false);
    }
  };

  const resetClassLookup = () => {
    setClassLookupResult(null);
    setClassCode("");
    setSchoolLookupResult(null);
    setSchoolCode("");
  };

  return (
    <div className="curve-root min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0814] text-white">
      {/* Curve ambient background orbs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-[#8b5cf6]/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#f472b6]/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-[40%] right-[10%] w-[30%] h-[30%] bg-[#fbbf24]/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-[#8b5cf6] flex items-center justify-center font-black text-white text-2xl shadow-lg">
              C
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Curve
          </h1>
          <p className="text-xs font-semibold text-curve-muted mt-1">
            Know your grade before your professor does
          </p>
        </div>

        <div className="bg-[#130f24]/90 backdrop-blur-xl rounded-[28px] border border-white/10 shadow-2xl p-8">
          {/* Role Selection */}
          {schoolPortal ? (
            <div className="grid grid-cols-3 gap-1 p-1 bg-white/5 rounded-2xl mb-4 border border-white/10">
              {(
                [
                  ["chain_head", "Chain head", Shield],
                  ["principal", "Principal", GraduationCap],
                  ["teacher", "Teacher", BookOpen],
                ] as const
              ).map(([role, label, Icon]) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => selectSchoolRole(role)}
                  className={`min-w-0 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${schoolRole === role ? "bg-[#8b5cf6] text-white shadow-md" : "text-white/60 hover:text-white"}`}
                >
                  <Icon className="w-4 h-4 shrink-0" /> {label}
                </button>
              ))}
            </div>
          ) : !studentPortal ? (
            <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl mb-4 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setUserRole("student");
                  resetClassLookup();
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${userRole === "student" ? "bg-[#8b5cf6] text-white shadow-md" : "text-white/60 hover:text-white"}`}
              >
                <GraduationCap className="w-4 h-4" /> Student
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserRole("teacher");
                  resetClassLookup();
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${userRole === "teacher" ? "bg-[#8b5cf6] text-white shadow-md" : "text-white/60 hover:text-white"}`}
              >
                <BookOpen className="w-4 h-4" /> Teacher
              </button>
            </div>
          ) : null}

          {/* Sign In / Sign Up Toggle */}
          {leaderSignInOnly ? (
            <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-sm font-bold text-white">Sign in only</p>
              <p className="mt-1 text-xs leading-5 text-curve-muted">
                {schoolRole === "chain_head"
                  ? "Chain-head access is provisioned by the platform administrator."
                  : "Principal access is provisioned for a specific school."}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl mb-6 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  resetClassLookup();
                }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${!isSignUp ? "bg-[#8b5cf6] text-white shadow-md" : "text-white/60 hover:text-white"}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  resetClassLookup();
                }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${isSignUp ? "bg-[#8b5cf6] text-white shadow-md" : "text-white/60 hover:text-white"}`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Student: Class Code */}
          {!schoolPortal &&
            effectiveRole === "student" &&
            isSignUp &&
            !classLookupResult && (
              <form onSubmit={handleClassCodeLookup} className="space-y-4 mb-6">
                <div className="text-center">
                  <h2 className="text-lg font-bold text-white">
                    Join Your Class
                  </h2>
                  <p className="text-curve-muted text-sm mt-1">
                    Ask your teacher for the class code.
                  </p>
                </div>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    type="text"
                    required
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                    className="w-full pl-11 py-3 bg-[#1c162e] border border-white/10 rounded-xl text-center text-xl font-mono tracking-widest text-white placeholder-white/40 focus:border-[#8b5cf6] focus:outline-none"
                    placeholder="XXXXXX"
                    maxLength={10}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={codeLoading || !classCode.trim()}
                  className="w-full py-3 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 group disabled:opacity-50 shadow-lg text-sm"
                >
                  {codeLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Looking up...
                    </>
                  ) : (
                    <>
                      Continue{" "}
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            )}

          {/* Student: Class Confirmed */}
          {!schoolPortal && effectiveRole === "student" && classLookupResult && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-center">
              <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 flex items-center justify-center text-[#c4b5fd] mx-auto mb-2">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="font-bold text-white">
                {classLookupResult.class_name}
              </p>
              <p className="text-curve-muted text-sm">
                with {classLookupResult.teacher_name}
              </p>
              <button
                onClick={resetClassLookup}
                className="text-curve-muted hover:text-white text-xs font-semibold mt-2 underline"
              >
                Use different code
              </button>
            </div>
          )}

          {/* Teacher: School code */}
          {effectiveRole === "teacher" && isSignUp && (
            <div className="mb-6">
              {!schoolLookupResult ? (
                <form onSubmit={handleSchoolCodeLookup} className="space-y-3">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                    <p className="text-sm text-curve-muted font-medium">
                      Enter the campus school code from your principal.
                    </p>
                  </div>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <input
                      type="text"
                      value={schoolCode}
                      onChange={(e) =>
                        setSchoolCode(e.target.value.toUpperCase())
                      }
                      className="w-full pl-11 py-3 bg-[#1c162e] border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-[#8b5cf6] focus:outline-none uppercase tracking-wider text-sm"
                      placeholder="School code"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={codeLoading || !schoolCode.trim()}
                    className="w-full py-2.5 rounded-full bg-[#8b5cf6] text-white text-xs font-black uppercase tracking-wide disabled:opacity-50"
                  >
                    {codeLoading ? "Checking…" : "Find school"}
                  </button>
                </form>
              ) : (
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 text-center">
                  <p className="text-sm font-bold text-emerald-300">
                    {schoolLookupResult.name}
                  </p>
                  <p className="text-xs text-emerald-400/80 mt-1">
                    Code {schoolLookupResult.code}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSchoolLookupResult(null);
                      setSchoolCode("");
                    }}
                    className="text-curve-muted hover:text-white text-xs font-semibold mt-2 underline"
                  >
                    Use different code
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  required={isSignUp}
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      full_name: e.target.value,
                    }))
                  }
                  className="w-full pl-11 py-3 bg-[#1c162e] border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-[#8b5cf6] focus:outline-none text-sm font-medium"
                  placeholder="Full Name"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                className="w-full pl-11 py-3 bg-[#1c162e] border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-[#8b5cf6] focus:outline-none text-sm font-medium"
                placeholder="Email Address"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                className="w-full pl-11 py-3 bg-[#1c162e] border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-[#8b5cf6] focus:outline-none text-sm font-medium"
                placeholder="Password"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                (effectiveRole === "teacher" && isSignUp && !schoolLookupResult)
              }
              className="w-full py-3.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-extrabold text-sm rounded-full transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Please wait...
                </>
              ) : (
                <>
                  {isSignUp ? "Create Account" : "Sign In"}{" "}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {!schoolPortal && (
            <>
              <div className="flex items-center my-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="mx-3 text-curve-faint text-xs font-bold uppercase tracking-wider">
                  Or
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <button
                type="button"
                disabled={googleLoading || loading}
                onClick={handleGoogleSignIn}
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm rounded-full transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="w-5 h-5 shrink-0"
                  >
                    <path
                      fill="#FFC107"
                      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.17 0 9.86-1.977 13.409-5.197l-6.19-5.236C29.133 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.553 5.047C9.482 39.556 16.227 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-3.994 5.566l.003-.002 6.19 5.236C35.246 40.416 40 34.667 40 26c0-1.341-.138-2.65-.389-3.917z"
                    />
                  </svg>
                )}
                Continue with Google
              </button>
            </>
          )}

          {leaderSignInOnly && (
            <>
              <div className="flex items-center my-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="mx-3 text-curve-faint text-xs font-bold uppercase tracking-wider">
                  Or
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <button
                type="button"
                disabled={emailLinkLoading || loading}
                onClick={handleLeaderEmailLink}
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailLinkLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Mail className="h-5 w-5" />
                )}
                Email me a secure sign-in link
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Auth;
