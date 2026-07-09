import React, { useState, useEffect } from "react";
import { 
  Bot, 
  Sparkles, 
  FileText, 
  Settings as SettingsIcon, 
  User, 
  Briefcase, 
  Trash2, 
  Copy, 
  Check, 
  Info, 
  BookOpen, 
  Plus, 
  Award, 
  Compass, 
  HelpCircle, 
  FileCheck, 
  ArrowRight, 
  Search, 
  X,
  Languages,
  UserCheck,
  Save
} from "lucide-react";
import { ResumeDraft, UserProfile, KeywordRecommendation, InterviewPrepQuestion } from "./types";

// Firebase Integration
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  collection, 
  deleteDoc,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App, Firestore and Auth
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(firebaseApp);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  // Navigation tabs: 'home' | 'cabinet' | 'tools' | 'settings'
  const [activeTab, setActiveTab] = useState<"home" | "cabinet" | "tools" | "settings">("home");

  // --- Home State ---
  const [jobTitle, setJobTitle] = useState("");
  const [strengths, setStrengths] = useState("");
  const [experience, setExperience] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    title: string;
    subtitle: string;
    paragraphs: string[];
    recommendation: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isDbSaved, setIsDbSaved] = useState(false);
  const [isDbSaving, setIsDbSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // --- Cabinet State ---
  const [savedResumes, setSavedResumes] = useState<ResumeDraft[]>([]);
  const [cabinetSearch, setCabinetSearch] = useState("");
  const [selectedResume, setSelectedResume] = useState<ResumeDraft | null>(null);

  // --- Tools State ---
  const [toolTab, setToolTab] = useState<"keywords" | "interview" | "counter">("keywords");
  
  // Keyword Tool
  const [keywordJob, setKeywordJob] = useState("");
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [keywordsList, setKeywordsList] = useState<KeywordRecommendation[]>([]);
  
  // Interview Tool
  const [interviewJob, setInterviewJob] = useState("");
  const [interviewExp, setInterviewExp] = useState("");
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewPrepQuestion[]>([]);

  // Character Counter Tool
  const [counterText, setCounterText] = useState("");

  // --- Settings State ---
  const [profile, setProfile] = useState<UserProfile>({
    name: "커리어 메이트",
    targetJob: "",
    careerLength: "1-3년",
    tonePreference: "전문적이고 설득력 있는 비즈니스 어조",
  });
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);

  // --- Firebase User and Loading State ---
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);

  // Load Saved Resumes and Profile from Firebase / LocalStorage
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await loadUserData(user.uid);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          if (cred.user) {
            setCurrentUser(cred.user);
            await loadUserData(cred.user.uid);
          }
        } catch (err) {
          console.warn("Firebase Anonymous Auth restricted, using local session fallback:", err);
          
          // Fallback guest UUID
          let guestUid = localStorage.getItem("guest_firebase_uid");
          if (!guestUid) {
            guestUid = "guest_" + Math.random().toString(36).substring(2, 15);
            localStorage.setItem("guest_firebase_uid", guestUid);
          }
          
          const mockUser = { uid: guestUid } as FirebaseUser;
          setCurrentUser(mockUser);
          await loadUserData(guestUid);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const loadUserData = async (uid: string) => {
    setIsFirebaseLoading(true);
    try {
      // 1. Fetch Profile
      const profileDocRef = doc(db, "users", uid);
      const profileDoc = await getDoc(profileDocRef);
      
      let finalProfile: UserProfile = profile;
      if (profileDoc.exists()) {
        finalProfile = profileDoc.data() as UserProfile;
        setProfile(finalProfile);
        if (finalProfile.targetJob && !jobTitle) {
          setJobTitle(finalProfile.targetJob);
        }
      } else {
        // Migration from LocalStorage if exists
        const localProfileStr = localStorage.getItem("user_profile");
        if (localProfileStr) {
          try {
            finalProfile = JSON.parse(localProfileStr);
            setProfile(finalProfile);
            await setDoc(profileDocRef, finalProfile);
          } catch (e) {
            console.warn("Could not save initial profile to Firestore:", e);
          }
        }
      }

      // 2. Fetch Resumes
      const resumesColRef = collection(db, "users", uid, "resumes");
      const resumesSnapshot = await getDocs(resumesColRef);
      
      if (!resumesSnapshot.empty) {
        const list: ResumeDraft[] = [];
        resumesSnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as ResumeDraft);
        });
        list.sort((a, b) => Number(b.id) - Number(a.id));
        setSavedResumes(list);
        localStorage.setItem("saved_resumes", JSON.stringify(list));
      } else {
        // Migration from LocalStorage if exists
        const localResumesStr = localStorage.getItem("saved_resumes");
        if (localResumesStr) {
          try {
            const localList = JSON.parse(localResumesStr) as ResumeDraft[];
            setSavedResumes(localList);
            // Migrate to firestore in background
            for (const resume of localList) {
              await setDoc(doc(db, "users", uid, "resumes", resume.id), resume);
            }
          } catch (e) {
            console.warn("Could not migrate resumes to Firestore:", e);
          }
        }
      }
    } catch (err) {
      console.warn("Error loading data from Firestore (permission restricted):", err);
      loadFromLocalStorage();
    } finally {
      setIsFirebaseLoading(false);
    }
  };

  const loadFromLocalStorage = () => {
    const resumes = localStorage.getItem("saved_resumes");
    if (resumes) {
      try {
        setSavedResumes(JSON.parse(resumes));
      } catch (e) {
        console.warn("Failed to parse local resumes:", e);
      }
    }

    const savedProfile = localStorage.getItem("user_profile");
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setProfile(parsed);
        if (parsed.targetJob && !jobTitle) {
          setJobTitle(parsed.targetJob);
        }
      } catch (e) {
        console.warn("Failed to parse local profile:", e);
      }
    }
  };

  // Helper chips handler
  const handleStrengthChipClick = (strength: string) => {
    if (strengths.includes(strength)) return;
    setStrengths(prev => prev ? `${prev}, ${strength}` : strength);
  };

  // Copy to clipboard
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate Resume API call
  const handleGenerate = async () => {
    if (!jobTitle.trim()) {
      setErrorMessage("직무명을 입력해 주세요.");
      return;
    }
    if (!experience.trim()) {
      setErrorMessage("경험 내용을 입력해 주세요.");
      return;
    }

    setErrorMessage("");
    setIsLoading(true);
    setResult(null);
    setIsSaved(false);
    setIsDbSaved(false);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          strengths,
          experience,
          profileTone: profile.tonePreference
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "자기소개서 생성 실패");
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "서버와 통신하는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Save generated resume to Cabinet
  const handleSaveToCabinet = async () => {
    if (!result) return;
    
    const newResume: ResumeDraft = {
      id: Date.now().toString(),
      jobTitle,
      strengths,
      experience,
      generatedTitle: result.title,
      generatedSubtitle: result.subtitle,
      paragraphs: result.paragraphs,
      recommendation: result.recommendation,
      createdAt: new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const updated = [newResume, ...savedResumes];
    setSavedResumes(updated);
    localStorage.setItem("saved_resumes", JSON.stringify(updated));
    setIsSaved(true);

    if (currentUser) {
      try {
        await setDoc(doc(db, "users", currentUser.uid, "resumes", newResume.id), newResume);
      } catch (err) {
        console.warn("Firestore save resume warning:", err);
      }
    }
  };

  // Save to global resumes collection in Firestore
  const handleSaveToResumesCollection = async () => {
    if (!result) return;
    setIsDbSaving(true);
    try {
      const fullContent = getFullResumeString(
        result.title,
        result.subtitle,
        result.paragraphs,
        result.recommendation
      );

      await addDoc(collection(db, "resumes"), {
        jobTitle: jobTitle,
        strength: strengths,
        experience: experience,
        content: fullContent,
        userId: "anonymous",
        createdAt: serverTimestamp(),
      });

      setIsDbSaved(true);
      setTimeout(() => {
        setIsDbSaved(false);
      }, 2000);
    } catch (err) {
      console.warn("Firestore resumes collection save warning:", err);
      handleFirestoreError(err, OperationType.CREATE, "resumes");
    } finally {
      setIsDbSaving(false);
    }
  };

  // Delete saved resume
  const handleDeleteResume = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm("이 자기소개서를 보관함에서 삭제하시겠습니까?")) {
      const updated = savedResumes.filter(item => item.id !== id);
      setSavedResumes(updated);
      localStorage.setItem("saved_resumes", JSON.stringify(updated));
      if (selectedResume?.id === id) {
        setSelectedResume(null);
      }

      if (currentUser) {
        try {
          await deleteDoc(doc(db, "users", currentUser.uid, "resumes", id));
        } catch (err) {
          console.warn("Firestore delete resume warning:", err);
        }
      }
    }
  };

  // --- Keyword Recommendation tool call ---
  const handleGenerateKeywords = async () => {
    if (!keywordJob.trim()) return;
    setKeywordLoading(true);
    try {
      const res = await fetch("/api/tools/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: keywordJob }),
      });
      const data = await res.json();
      setKeywordsList(data.keywords || []);
    } catch (err) {
      console.error(err);
    } finally {
      setKeywordLoading(false);
    }
  };

  // --- Interview Question tool call ---
  const handleGenerateInterview = async () => {
    if (!interviewJob.trim() || !interviewExp.trim()) return;
    setInterviewLoading(true);
    try {
      const res = await fetch("/api/tools/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: interviewJob, experience: interviewExp }),
      });
      const data = await res.json();
      setInterviewQuestions(data.questions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setInterviewLoading(false);
    }
  };

  // Save Settings Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProfileSaving(true);
    localStorage.setItem("user_profile", JSON.stringify(profile));
    
    if (currentUser) {
      try {
        await setDoc(doc(db, "users", currentUser.uid), profile);
      } catch (err) {
        console.warn("Firestore save profile warning:", err);
      }
    }
    
    setIsProfileSaving(false);
    setSettingsSavedMessage(true);
    setTimeout(() => setSettingsSavedMessage(false), 2000);
  };

  // Copy full resume content helper
  const getFullResumeString = (title: string, subtitle: string, paragraphs: string[], recommendation: string) => {
    return `${title}\n${subtitle}\n\n${paragraphs.join("\n\n")}\n\n[AI 메이트의 추천 및 피드백]\n${recommendation}`;
  };

  if (isFirebaseLoading) {
    return (
      <div id="firebase_loader" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-sm">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 shadow-md animate-bounce">
              <Bot className="text-indigo-600 w-8 h-8" />
            </div>
            <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-ping"></div>
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-black text-slate-800">클라우드 동기화 중...</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              자소서 메이트가 안전한 클라우드 백엔드 환경을 구성하고 사용자 데이터를 불러오고 있습니다.
            </p>
          </div>
          <div className="w-24 h-1.5 bg-slate-200 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full w-2/3 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="app_root" className="min-h-screen bg-[#F1F5F9] text-[#0f172a] flex flex-col lg:flex-row font-sans">
      
      {/* Sidebar for Desktop (1024px+) */}
      <aside id="desktop_sidebar" className="hidden lg:flex flex-col fixed left-0 top-0 h-full p-6 bg-white w-80 border-r border-slate-200/80 z-50 justify-between">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 shadow-sm">
              <Bot className="text-indigo-600 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 tracking-tight">자소서 메이트</h1>
              <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-wider">AI resume consultant</span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-2">
            <button
              id="sidebar_nav_home"
              onClick={() => setActiveTab("home")}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                activeTab === "home"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-5 h-5" />
              <span>자기소개서 작성</span>
            </button>

            <button
              id="sidebar_nav_cabinet"
              onClick={() => setActiveTab("cabinet")}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                activeTab === "cabinet"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>내 보관함</span>
              {savedResumes.length > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {savedResumes.length}
                </span>
              )}
            </button>

            <button
              id="sidebar_nav_tools"
              onClick={() => setActiveTab("tools")}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                activeTab === "tools"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <BookOpen className="w-5 h-5" />
              <span>AI 도구 모음</span>
            </button>

            <button
              id="sidebar_nav_settings"
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                activeTab === "settings"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span>설정</span>
            </button>
          </nav>
        </div>

        {/* User Card */}
        <div id="desktop_user_card" className="p-4 bg-slate-50 rounded-3xl border border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">{profile.name || "커리어 메이트"}</p>
              <p className="text-xs text-indigo-600 font-extrabold">{profile.careerLength} 경력 • Pro 플랜</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Top Bar for Mobile */}
      <header id="mobile_header" className="lg:hidden sticky top-0 bg-white border-b border-slate-200/80 px-4 py-3.5 z-40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="text-indigo-600 w-6 h-6" />
          <h1 className="text-lg font-black text-slate-800">자소서 메이트</h1>
        </div>
        <div className="text-xs bg-indigo-50 text-indigo-600 font-extrabold px-3 py-1.5 rounded-full border border-indigo-100">
          Pro 플랜
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main_content_container" className="flex-1 lg:pl-80 pb-20 lg:pb-0 min-h-screen flex flex-col">
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-8">
          
          {/* Active Screen Rendering */}

          {/* --- TAB: HOME (자기소개서 작성) --- */}
          {activeTab === "home" && (
            <div id="screen_home" className="space-y-6 animate-fadeIn">
              
              {/* Header Title Block */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-sm">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">자소서 메이트 Dashboard</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                    인공지능 취업 파트너와 함께하는 스마트 자기소개서 빌더
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs bg-indigo-50 text-indigo-700 font-extrabold px-3 py-1.5 rounded-full border border-indigo-100/60">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                  <span>AI 분석 엔진 활성화</span>
                </div>
              </div>

              {/* Bento Grid Header Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Bento Item 1: Active Profile Info */}
                <div className="bg-white rounded-[24px] border border-slate-200 p-5 flex items-center justify-between relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-10 -mt-10 blur-2xl opacity-60"></div>
                  <div className="relative z-10 space-y-1">
                    <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-indigo-100/40">Active Profile</span>
                    <h4 className="text-base font-extrabold text-slate-800 mt-2">{profile.name}님</h4>
                    <p className="text-[11px] text-slate-400 font-semibold">{profile.careerLength} 경력 • {profile.tonePreference.slice(0, 15)}...</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold relative z-10 border border-indigo-100/50">
                    <User className="w-6 h-6" />
                  </div>
                </div>

                {/* Bento Item 2: Saved Resumes count */}
                <div 
                  onClick={() => setActiveTab("cabinet")}
                  className="bg-white rounded-[24px] border border-slate-200 p-5 flex flex-col justify-between hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer shadow-sm group"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">보관된 자소서</span>
                    <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100/30 group-hover:bg-indigo-100">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-800 tracking-tight">{savedResumes.length}</span>
                    <span className="text-xs text-slate-400 font-bold">건 보관됨</span>
                  </div>
                </div>

                {/* Bento Item 3: Quick Tool box stats */}
                <div 
                  onClick={() => setActiveTab("tools")}
                  className="bg-indigo-600 rounded-[24px] p-5 text-white flex flex-col justify-between hover:bg-indigo-700 transition-all cursor-pointer shadow-sm group"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black text-indigo-200 uppercase tracking-wider">가용한 AI 도구</span>
                    <div className="w-8 h-8 bg-indigo-500/30 text-white rounded-xl flex items-center justify-center group-hover:bg-indigo-500/50">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black tracking-tight">3개</span>
                    <span className="text-xs text-indigo-200 font-bold">키워드 / 질문 / 글자수</span>
                  </div>
                </div>
              </div>

              {/* Grid Content */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Input Form Container */}
                <div id="form_section" className="lg:col-span-7 bg-white rounded-[28px] border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-sm">
                  <div className="flex items-center gap-2.5 text-indigo-600">
                    <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                      <FileText className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-black text-slate-800">새 자기소개서 초안 작성</h3>
                  </div>

                  {errorMessage && (
                    <div className="p-3.5 bg-rose-50 text-rose-700 text-xs sm:text-sm rounded-2xl flex items-center gap-2 font-semibold border border-rose-100">
                      <span className="font-bold">⚠️ 오류:</span> {errorMessage}
                    </div>
                  )}

                  <div className="space-y-5">
                    {/* Job Title Input */}
                    <div className="space-y-1.5">
                      <label htmlFor="job-title" className="text-xs font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        <span>희망 직무명</span>
                      </label>
                      <input
                        id="job-title"
                        type="text"
                        placeholder="예) 마케터, IT 기획자, 개발자"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 focus:bg-white transition-all"
                      />
                    </div>

                    {/* Strengths Input with recommendation chips */}
                    <div className="space-y-1.5">
                      <label htmlFor="strengths" className="text-xs font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
                        <Award className="w-3.5 h-3.5 text-slate-400" />
                        <span>나의 핵심 역량 / 강점</span>
                      </label>
                      <input
                        id="strengths"
                        type="text"
                        placeholder="예) 데이터 분석, 커뮤니케이션, 위기대처"
                        value={strengths}
                        onChange={(e) => setStrengths(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 focus:bg-white transition-all"
                      />
                      {/* Interactive Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {["#문제해결력", "#리더십", "#창의성", "#커뮤니케이션", "#데이터기반"].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => handleStrengthChipClick(chip.replace("#", ""))}
                            className="text-[11px] bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white transition-all px-3 py-1 rounded-full font-bold border border-slate-200/80 cursor-pointer"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Experience Textarea */}
                    <div className="space-y-1.5">
                      <label htmlFor="experience" className="text-xs font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
                        <Compass className="w-3.5 h-3.5 text-slate-400" />
                        <span>주요 경험 스토리 (핵심 내용)</span>
                      </label>
                      <textarea
                        id="experience"
                        rows={6}
                        placeholder="예) 인턴 6개월 동안 인스타그램 광고를 집행해 매출을 150% 성장시켰습니다. 분석 툴을 도입하여 타겟팅 효율을 개선했습니다."
                        value={experience}
                        onChange={(e) => setExperience(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 focus:bg-white transition-all resize-none leading-relaxed"
                      />
                      <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 flex items-start gap-2 text-xs text-indigo-700 leading-relaxed font-semibold">
                        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>숫자나 기간을 포함한 구체적인 기여 사항과 결과 위주로 작성하면 품질이 한층 더 높아집니다.</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      id="btn_generate"
                      onClick={handleGenerate}
                      disabled={isLoading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-sm shadow-md shadow-indigo-600/10 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>{isLoading ? "AI 메이트가 자소서를 설계 중..." : "AI 자기소개서 생성하기"}</span>
                    </button>
                  </div>
                </div>

                {/* Right: Results / Guidance Container */}
                <div id="results_section" className="lg:col-span-5 flex flex-col gap-6">
                  {/* Generated Output Area */}
                  <div className={`relative flex-1 rounded-[28px] border p-6 flex flex-col justify-center min-h-[420px] transition-all shadow-sm ${
                    result ? "border-slate-200 bg-white" : "border-slate-200 border-dashed bg-white text-center"
                  }`}>
                    {/* Empty State or Error State */}
                    {!isLoading && !result && (
                      errorMessage ? (
                        <div id="error_state" className="space-y-4 max-w-sm mx-auto p-4 animate-fadeIn">
                          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto border border-rose-100 shadow-xs">
                            <Info className="text-rose-600 w-7 h-7" />
                          </div>
                          <h4 className="text-base font-extrabold text-rose-800">자기소개서 설계 오류 발생</h4>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            자소서 생성 도중 예기치 못한 에러가 발생했습니다. 작성 중이던 내용은 안전하게 유지되고 있으니 걱정 마세요.
                          </p>
                          <div className="p-3 bg-rose-50/70 text-rose-700 text-xs rounded-xl border border-rose-100 text-left font-semibold break-all leading-relaxed">
                            <strong className="block text-rose-800 mb-0.5">상세 원인:</strong>
                            {errorMessage}
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium">
                            일시적인 서비스 트래픽 초과 또는 모델 요청 제한일 수 있으니, 아래 버튼을 눌러 다시 자소서를 설계해 보세요.
                          </p>
                          <button
                            onClick={handleGenerate}
                            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-black text-xs shadow-md shadow-indigo-600/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>AI 메이트 자소서 다시 생성하기</span>
                          </button>
                        </div>
                      ) : (
                        <div id="empty_state" className="space-y-4 max-w-sm mx-auto p-4">
                          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100/60 shadow-xs">
                            <Bot className="text-indigo-600 w-7 h-7" />
                          </div>
                          <h4 className="text-base font-extrabold text-slate-800">생성된 결과물이 여기에 표시됩니다</h4>
                          <p className="text-xs text-slate-400 leading-relaxed font-medium">
                            왼쪽 양식에 직무와 경험을 채우고 버튼을 눌러보세요. 자소서 메이트가 기업 인사담당자들이 선호하는 뛰어난 흐름과 표현으로 다듬어 드립니다.
                          </p>
                        </div>
                      )
                    )}

                    {/* Loading State Skeleton */}
                    {isLoading && (
                      <div id="loading_skeleton" className="space-y-5 animate-pulse w-full">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                          <div className="h-6 bg-slate-200 rounded-md w-1/2"></div>
                          <div className="h-4 bg-slate-200 rounded-md w-12"></div>
                        </div>
                        <div className="space-y-3.5">
                          <div className="h-4 bg-slate-200 rounded-md w-1/3"></div>
                          <div className="h-4 bg-slate-200 rounded-md w-full"></div>
                          <div className="h-4 bg-slate-200 rounded-md w-full"></div>
                          <div className="h-4 bg-slate-200 rounded-md w-5/6"></div>
                        </div>
                        <div className="h-28 bg-indigo-50/50 rounded-2xl border border-dashed border-indigo-100 flex items-center justify-center p-4">
                          <p className="text-xs text-indigo-700 font-extrabold flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></span>
                            <span>AI가 문장력 강화와 STAR 구조화를 진행 중...</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Output Render */}
                    {!isLoading && result && (
                      <div id="result_output" className="space-y-5 text-left h-full flex flex-col justify-between relative">
                        {/* Floating Copy Button on top-right of result area */}
                        <button
                          onClick={() => handleCopyText(getFullResumeString(result.title, result.subtitle, result.paragraphs, result.recommendation))}
                          className={`absolute top-0 right-0 z-20 flex items-center gap-1.5 text-xs border transition-all px-3 py-1.5 rounded-xl font-bold cursor-pointer shadow-sm ${
                            copied
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : "bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-50"
                          }`}
                        >
                          {copied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                              <span>복사됨!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>복사하기</span>
                            </>
                          )}
                        </button>

                        <div>
                          {/* Header of output */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-4 pr-24">
                            <h4 className="text-sm font-black text-indigo-600 flex items-center gap-2">
                              <FileCheck className="w-5 h-5" />
                              <span>생성된 자기소개서 초안</span>
                            </h4>
                            <div className="flex gap-1.5">
                              {/* Save to Storage Button */}
                              <button
                                onClick={handleSaveToCabinet}
                                disabled={isSaved}
                                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                                  isSaved
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                                }`}
                              >
                                <Check className="w-4 h-4" />
                                <span>{isSaved ? "보관됨" : "보관함 저장"}</span>
                              </button>

                              {/* Save to Firestore Resumes Collection Button */}
                              <button
                                onClick={handleSaveToResumesCollection}
                                disabled={isDbSaving}
                                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer border ${
                                  isDbSaved
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : isDbSaving
                                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                    : "bg-slate-900 text-white border-slate-900 hover:bg-slate-800 shadow-sm"
                                }`}
                              >
                                {isDbSaving ? (
                                  <>
                                    <span className="w-3 h-3 border-2 border-slate-300 border-t-white rounded-full animate-spin"></span>
                                    <span>저장 중...</span>
                                  </>
                                ) : isDbSaved ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                                    <span>저장됐습니다!</span>
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-3.5 h-3.5" />
                                    <span>저장하기</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Cover Letter Title */}
                          <div className="mt-4 space-y-4">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-indigo-600 tracking-wider uppercase bg-indigo-50 px-2 py-0.5 rounded-md inline-block">{result.subtitle}</p>
                              <h5 className="text-base sm:text-lg font-black text-slate-850 leading-snug pt-1">{result.title}</h5>
                            </div>

                            {/* Paragraphs */}
                            <div className="space-y-3.5 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                              {result.paragraphs.map((p, i) => (
                                <p key={i}>{p}</p>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Recommendation Card */}
                        <div className="mt-6 p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100/50">
                          <p className="text-xs text-indigo-700 font-black mb-1 flex items-center gap-1.5">
                            <Award className="w-4 h-4 shrink-0" />
                            <span>컨설턴트 메이트 피드백</span>
                          </p>
                          <p className="text-xs text-slate-500 leading-relaxed font-semibold">{result.recommendation}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pro Tip Card - Designed like dark Bento piece */}
                  <div className="bg-slate-900 text-white p-6 rounded-[28px] relative overflow-hidden shadow-md">
                    <div className="absolute right-[-24px] bottom-[-24px] text-white/5 transform rotate-12 scale-150 pointer-events-none">
                      <Bot className="w-36 h-36" />
                    </div>
                    <div className="relative z-10 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="bg-white/10 p-1.5 rounded-xl">
                          <Sparkles className="w-4 h-4 text-indigo-400" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Pro 팁 & 핵심 채용 트렌드</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-semibold">
                        인사담당자들은 모호한 문어체보다 <span className="underline decoration-indigo-400 decoration-wavy underline-offset-4 font-bold text-white">구체적인 프로젝트 지표와 기여 실적</span>을 먼저 파악합니다. 메이트의 추천 가이드를 활용해 나만의 강점 문장을 완성해보세요!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB: CABINET (보관함) --- */}
          {activeTab === "cabinet" && (
            <div id="screen_cabinet" className="space-y-6 animate-fadeIn">
              {/* Header Card */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-sm">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">내 자소서 보관함</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">저장된 다양한 자기소개서 초안을 실시간으로 검색하고 복사할 수 있습니다.</p>
                </div>
                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="직무명 또는 키워드 검색..."
                    value={cabinetSearch}
                    onChange={(e) => setCabinetSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 font-medium transition-all"
                  />
                </div>
              </div>

              {/* Saved Resumes List Grid */}
              {savedResumes.length === 0 ? (
                <div className="bg-white rounded-[28px] border border-slate-200/80 p-12 text-center space-y-4 shadow-sm">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 border border-indigo-100/60 shadow-xs">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div className="max-w-md mx-auto space-y-2">
                    <p className="text-base font-extrabold text-slate-800">아직 보관된 자기소개서가 없습니다</p>
                    <p className="text-xs text-slate-400 leading-relaxed font-semibold">당신만의 스토리와 경험을 AI 취업 파트너에게 전하고 멋진 자기소개서를 보관해 보세요!</p>
                  </div>
                  <button
                    onClick={() => setActiveTab("home")}
                    className="px-5 py-3 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all cursor-pointer shadow-md shadow-indigo-600/10"
                  >
                    첫 자소서 생성하기
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {savedResumes
                    .filter(item => 
                      item.jobTitle.toLowerCase().includes(cabinetSearch.toLowerCase()) || 
                      item.generatedTitle.toLowerCase().includes(cabinetSearch.toLowerCase()) || 
                      item.generatedSubtitle.toLowerCase().includes(cabinetSearch.toLowerCase())
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedResume(item)}
                        className="bg-white rounded-[24px] border border-slate-200/80 p-6 cursor-pointer hover:border-indigo-600 transition-all flex flex-col justify-between hover:shadow-lg shadow-sm group"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-black uppercase tracking-wider border border-indigo-100/40">
                              {item.jobTitle}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">{item.createdAt}</span>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-bold">{item.generatedSubtitle}</p>
                            <h4 className="text-base font-black text-slate-800 group-hover:text-indigo-600 transition-colors mt-1 line-clamp-1">
                              {item.generatedTitle}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed font-semibold">
                            {item.paragraphs[0]}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 mt-5 pt-4">
                          <span className="text-xs text-indigo-600 font-black flex items-center gap-1">
                            자세히 보기 <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                          <button
                            onClick={(e) => handleDeleteResume(item.id, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Detail view Modal */}
              {selectedResume && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-[28px] border border-slate-200/80 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
                    {/* Header */}
                    <div className="sticky top-0 bg-white px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-black uppercase tracking-wider border border-indigo-100/40">
                          {selectedResume.jobTitle}
                        </span>
                        <span className="text-xs text-slate-450 font-bold">{selectedResume.createdAt}</span>
                      </div>
                      <button
                        onClick={() => setSelectedResume(null)}
                        className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 sm:p-8 space-y-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-indigo-600 tracking-wider uppercase bg-indigo-50 px-2 py-0.5 rounded-md inline-block">{selectedResume.generatedSubtitle}</p>
                        <h3 className="text-lg sm:text-xl font-black text-slate-850 leading-snug pt-1">{selectedResume.generatedTitle}</h3>
                      </div>

                      <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                        {selectedResume.paragraphs.map((p, i) => (
                          <p key={i} className="font-normal">{p}</p>
                        ))}
                      </div>

                      <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100/50">
                        <p className="text-xs text-indigo-700 font-black mb-1 flex items-center gap-1.5">
                          <Award className="w-4 h-4 shrink-0" />
                          <span>컨설턴트 메이트 피드백</span>
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">{selectedResume.recommendation}</p>
                      </div>

                      {/* Original Input Info panel */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs text-slate-500 space-y-2 font-medium">
                        <p className="font-black text-slate-700">📌 내가 입력했던 경험 배경:</p>
                        <p><strong>핵심 강점:</strong> {selectedResume.strengths || "지정되지 않음"}</p>
                        <p><strong>작성 경험:</strong> {selectedResume.experience}</p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                      <button
                        onClick={() => handleDeleteResume(selectedResume.id)}
                        className="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      >
                        삭제하기
                      </button>
                      <button
                        onClick={() => handleCopyText(getFullResumeString(selectedResume.generatedTitle, selectedResume.generatedSubtitle, selectedResume.paragraphs, selectedResume.recommendation))}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/10 transition-all cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                        <span>전체 내용 복사하기</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- TAB: AI TOOLS (도구 모음) --- */}
          {activeTab === "tools" && (
            <div id="screen_tools" className="space-y-6 animate-fadeIn">
              {/* Header Card */}
              <div className="bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">AI 커리어 도구 모음</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">합격률을 높여줄 핵심 키워드 가이드와 면접 및 실시간 자소서 분석 도구를 제공합니다.</p>
                </div>
              </div>

              {/* Sub tabs in Bento style */}
              <div className="bg-white p-2 rounded-2xl border border-slate-200/60 shadow-xs flex flex-wrap gap-1">
                <button
                  onClick={() => setToolTab("keywords")}
                  className={`flex-1 min-w-[120px] text-center px-4 py-3 text-xs font-black rounded-xl transition-all cursor-pointer ${
                    toolTab === "keywords"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  핵심 역량 키워드 추천
                </button>
                <button
                  onClick={() => setToolTab("interview")}
                  className={`flex-1 min-w-[120px] text-center px-4 py-3 text-xs font-black rounded-xl transition-all cursor-pointer ${
                    toolTab === "interview"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  면접 예상 질문 & 답변 팁
                </button>
                <button
                  onClick={() => setToolTab("counter")}
                  className={`flex-1 min-w-[120px] text-center px-4 py-3 text-xs font-black rounded-xl transition-all cursor-pointer ${
                    toolTab === "counter"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  글자수 세기 & 자소서 검사
                </button>
              </div>

              {/* Tool 1: Keywords */}
              {toolTab === "keywords" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left block */}
                  <div className="lg:col-span-4 bg-white rounded-[24px] border border-slate-200/80 p-6 space-y-4 shadow-sm flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100/50">
                        <Languages className="w-5 h-5 text-indigo-600" />
                      </div>
                      <h3 className="text-base font-extrabold text-slate-800">직무 핵심 역량 분석</h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                        지원하고자 하는 직무를 입력해 주세요. 인사담당자의 눈길을 사로잡을 수 있는 매력적인 역량 키워드 5개와 추천 이유, 예시 가이드를 생성해 드립니다.
                      </p>
                    </div>
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">희망 직무명</label>
                        <input
                          type="text"
                          placeholder="예) 브랜드 매니저, 백엔드 개발자"
                          value={keywordJob}
                          onChange={(e) => setKeywordJob(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 font-medium"
                        />
                      </div>
                      <button
                        onClick={handleGenerateKeywords}
                        disabled={keywordLoading || !keywordJob.trim()}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/10 cursor-pointer transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                      >
                        {keywordLoading ? "키워드 분석 중..." : "추천 키워드 생성"}
                      </button>
                    </div>
                  </div>

                  {/* Right block */}
                  <div className="lg:col-span-8 bg-white rounded-[24px] border border-slate-200/80 p-6 min-h-[300px] flex flex-col justify-center shadow-sm">
                    {keywordLoading ? (
                      <div className="space-y-4 animate-pulse w-full">
                        <div className="h-5 bg-slate-200 rounded w-1/4"></div>
                        <div className="space-y-3">
                          <div className="h-10 bg-slate-100 rounded-xl w-full"></div>
                          <div className="h-10 bg-slate-100 rounded-xl w-full"></div>
                          <div className="h-10 bg-slate-100 rounded-xl w-full"></div>
                        </div>
                      </div>
                    ) : keywordsList.length === 0 ? (
                      <div className="text-center space-y-3 max-w-sm mx-auto py-8">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto border border-slate-250/50">
                          <Languages className="w-6 h-6 text-slate-400" />
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-800">아직 생성된 키워드가 없습니다</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">직무명을 입력하고 키워드 추천을 시작해 보세요.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest">✨ 추천하는 5가지 주요 핵심 키워드</h4>
                        <div className="space-y-3.5">
                          {keywordsList.map((k, i) => (
                            <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/50 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100/60 px-2.5 py-0.5 rounded-full">{k.tag}</span>
                                <button
                                  onClick={() => handleCopyText(k.example)}
                                  className="text-[10px] text-slate-400 hover:text-indigo-600 flex items-center gap-1 font-bold"
                                >
                                  <Copy className="w-3 h-3" /> 예문 복사
                                </button>
                              </div>
                              <p className="text-xs font-bold text-slate-700 leading-relaxed">추천 이유: <span className="font-semibold text-slate-500">{k.reason}</span></p>
                              <div className="text-xs font-semibold text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/50 mt-1 italic">
                                &ldquo;{k.example}&rdquo;
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tool 2: Interview Questions */}
              {toolTab === "interview" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left block */}
                  <div className="lg:col-span-4 bg-white rounded-[24px] border border-slate-200/80 p-6 space-y-4 shadow-sm flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100/50">
                        <UserCheck className="w-5 h-5 text-indigo-600" />
                      </div>
                      <h3 className="text-base font-extrabold text-slate-800">면접 예상 질문 예측</h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                        지원하려는 직무명과 스토리 요약을 입력해 주세요. 실제 대기업/스타트업 면접에서 만날 수 있는 핵심 질문 3개와 합격 답변 팁을 추출해 드립니다.
                      </p>
                    </div>
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">희망 직무명</label>
                        <input
                          type="text"
                          placeholder="예) 프론트엔드 개발자"
                          value={interviewJob}
                          onChange={(e) => setInterviewJob(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">경험 요약 (3줄 내외)</label>
                        <textarea
                          rows={4}
                          placeholder="예) 공모전 최우수상 수상, API 서버 연동 기획 및 설계 주도"
                          value={interviewExp}
                          onChange={(e) => setInterviewExp(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 font-medium resize-none leading-relaxed"
                        />
                      </div>
                      <button
                        onClick={handleGenerateInterview}
                        disabled={interviewLoading || !interviewJob.trim() || !interviewExp.trim()}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/10 cursor-pointer transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                      >
                        {interviewLoading ? "질문 예측 중..." : "면접 예상 질문 생성"}
                      </button>
                    </div>
                  </div>

                  {/* Right block */}
                  <div className="lg:col-span-8 bg-white rounded-[24px] border border-slate-200/80 p-6 min-h-[300px] flex flex-col justify-center shadow-sm">
                    {interviewLoading ? (
                      <div className="space-y-4 animate-pulse w-full">
                        <div className="h-5 bg-slate-200 rounded w-1/4"></div>
                        <div className="space-y-3">
                          <div className="h-16 bg-slate-100 rounded-2xl w-full"></div>
                          <div className="h-16 bg-slate-100 rounded-2xl w-full"></div>
                        </div>
                      </div>
                    ) : interviewQuestions.length === 0 ? (
                      <div className="text-center space-y-3 max-w-sm mx-auto py-8">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto border border-slate-250/50">
                          <UserCheck className="w-6 h-6 text-slate-400" />
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-800">예상 면접 질문이 아직 생성되지 않았습니다</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">직무와 경험 요약을 넣고 면접을 미리 준비해보세요.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest">🎯 인사팀이 주목하는 예상 질문 및 전략</h4>
                        <div className="space-y-3.5">
                          {interviewQuestions.map((q, i) => (
                            <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/50 space-y-2">
                              <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100/50">질문 0{i + 1}</span>
                              <h5 className="text-sm font-black text-slate-800 leading-relaxed pt-1">{q.question}</h5>
                              <div className="text-xs space-y-1.5 text-slate-500 font-medium">
                                <p><strong>질문 설계 의도:</strong> {q.intent}</p>
                                <div className="text-indigo-700 font-semibold bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/30 mt-1">
                                  <strong>합격 답변 핵심 가이드:</strong> {q.tip}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tool 3: Character Counter */}
              {toolTab === "counter" && (
                <div className="bg-white rounded-[28px] border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <h3 className="text-base font-black text-slate-800">실시간 자소서 글자수 카운터</h3>
                    <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-500">
                      <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-100/50 shadow-xs">
                        공백 포함: <strong className="text-xs font-extrabold">{counterText.length}</strong> 자
                      </span>
                      <span className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded-full border border-slate-200/80 shadow-xs">
                        공백 제외: <strong className="text-xs font-extrabold">{counterText.replace(/\s/g, "").length}</strong> 자
                      </span>
                    </div>
                  </div>

                  <textarea
                    rows={10}
                    placeholder="작성하고 계신 자기소개서 본문을 복사하여 이곳에 붙여넣어 보세요. 실시간 글자수 계산과 표현 및 흐름 분석이 훨씬 쉬워집니다."
                    value={counterText}
                    onChange={(e) => setCounterText(e.target.value)}
                    className="w-full px-4 py-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 focus:bg-white transition-all resize-none leading-relaxed font-medium"
                  />

                  <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <p>팁: 분량 한도(예: 500자, 1000자)가 있는 주요 채용 양식을 작성할 때 용이하게 맞출 수 있습니다.</p>
                    <button
                      onClick={() => setCounterText("")}
                      className="text-rose-600 hover:underline font-extrabold cursor-pointer"
                    >
                      모두 비우기
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- TAB: SETTINGS (설정) --- */}
          {activeTab === "settings" && (
            <div id="screen_settings" className="space-y-6 animate-fadeIn">
              {/* Header Card */}
              <div className="bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">내 프로필 & 자소서 설정</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">나만의 경력 및 희망 맞춤 스타일을 동기화하여 초개인화된 자기소개서를 생성합니다.</p>
                </div>
              </div>

              <div className="bg-white rounded-[28px] border border-slate-200/80 p-6 sm:p-8 shadow-sm">
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  
                  {settingsSavedMessage && (
                    <div className="p-3 bg-emerald-50 text-emerald-700 text-xs sm:text-sm rounded-xl font-bold border border-emerald-200/50 flex items-center gap-2">
                      <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>프로필이 성공적으로 저장되었습니다! 홈 화면으로 이동 시 자동 반영됩니다.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* User Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider">이름 (가명 가능)</label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 font-semibold transition-all"
                      />
                    </div>

                    {/* Target Job Title */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider">목표 직무명</label>
                      <input
                        type="text"
                        placeholder="예) 데이터 엔지니어, 마케팅 디렉터"
                        value={profile.targetJob}
                        onChange={(e) => setProfile({ ...profile, targetJob: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 font-semibold transition-all"
                      />
                    </div>

                    {/* Career Length Select */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider">경력 사항</label>
                      <select
                        value={profile.careerLength}
                        onChange={(e) => setProfile({ ...profile, careerLength: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 font-semibold transition-all cursor-pointer"
                      >
                        <option value="신입">신입 (경력 없음)</option>
                        <option value="1-3년">1-3년차 주니어</option>
                        <option value="4-7년">4-7년차 미들</option>
                        <option value="8년+">8년차 이상 시니어</option>
                      </select>
                    </div>

                    {/* Tone preference select */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider">선호하는 문체/어조</label>
                      <select
                        value={profile.tonePreference}
                        onChange={(e) => setProfile({ ...profile, tonePreference: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 font-semibold transition-all cursor-pointer"
                      >
                        <option value="전문적이고 설득력 있는 비즈니스 어조">전문적이고 설득력 있는 비즈니스 어조</option>
                        <option value="강한 자부심과 열정이 가득한 어조">강한 자부심과 열정이 가득한 어조</option>
                        <option value="차분하고 논리적인 팩트 중심 어조">차분하고 논리적인 팩트 중심 어조</option>
                        <option value="친근하고 협업을 중요시하는 어조">친근하고 협업을 중요시하는 어조</option>
                      </select>
                    </div>
                  </div>

                   <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="submit"
                      disabled={isProfileSaving}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/10 transition-all cursor-pointer disabled:bg-indigo-400 flex items-center gap-2"
                    >
                      {isProfileSaving ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>저장 중...</span>
                        </>
                      ) : (
                        <span>설정 저장하기</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Bottom Nav Bar for Mobile Devices (under lg: 1024px) */}
      <nav id="mobile_bottom_navbar" className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center bg-white border-t border-slate-200/80 px-3 py-2 pb-safe shadow-lg">
        <button
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "home" ? "text-indigo-600 bg-indigo-50 font-black border border-indigo-100/40" : "text-slate-400 font-medium"
          }`}
        >
          <Sparkles className="w-5 h-5 mb-1" />
          <span className="text-[10px]">작성</span>
        </button>

        <button
          onClick={() => setActiveTab("cabinet")}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "cabinet" ? "text-indigo-600 bg-indigo-50 font-black border border-indigo-100/40" : "text-slate-400 font-medium"
          }`}
        >
          <div className="relative">
            <FileText className="w-5 h-5 mb-1" />
            {savedResumes.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] px-1 py-0.5 rounded-full font-extrabold scale-75">
                {savedResumes.length}
              </span>
            )}
          </div>
          <span className="text-[10px]">보관함</span>
        </button>

        <button
          onClick={() => setActiveTab("tools")}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "tools" ? "text-indigo-600 bg-indigo-50 font-black border border-indigo-100/40" : "text-slate-400 font-medium"
          }`}
        >
          <BookOpen className="w-5 h-5 mb-1" />
          <span className="text-[10px]">AI도구</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "settings" ? "text-indigo-600 bg-indigo-50 font-black border border-indigo-100/40" : "text-slate-400 font-medium"
          }`}
        >
          <SettingsIcon className="w-5 h-5 mb-1" />
          <span className="text-[10px]">설정</span>
        </button>
      </nav>

    </div>
  );
}
