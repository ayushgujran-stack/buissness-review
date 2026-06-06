"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronRight, ChevronLeft, Send, CheckCircle2, MapPin, Zap, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitFeedback, type FeedbackData } from "@/lib/services";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// --- Neo-Brutalist Layouts for Errors and Loading ---

const LoadingSkeleton = () => (
  <div className="w-full max-w-md mx-auto p-8 bg-white border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] text-center space-y-6">
    <div className="w-16 h-16 bg-gray-200 border-4 border-black rounded-2xl mx-auto animate-pulse" />
    <div className="h-8 bg-gray-200 border-2 border-black rounded animate-pulse w-3/4 mx-auto" />
    <div className="h-4 bg-gray-200 border-2 border-black rounded animate-pulse w-1/2 mx-auto" />
    <div className="space-y-3 pt-4">
      <div className="h-12 bg-gray-200 border-2 border-black rounded animate-pulse" />
      <div className="h-12 bg-gray-200 border-2 border-black rounded animate-pulse" />
    </div>
  </div>
);

const InvalidQRScreen = () => (
  <div className="w-full max-w-md mx-auto p-8 bg-white border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] text-center space-y-6">
    <div className="w-16 h-16 bg-red-400 border-4 border-black rounded-2xl flex items-center justify-center mx-auto shadow-[4px_4px_0px_rgba(0,0,0,1)]">
      <AlertCircle className="w-8 h-8 text-black" />
    </div>
    <h2 className="text-2xl font-black text-black uppercase tracking-tight">Invalid Review Link</h2>
    <p className="text-black font-bold text-sm leading-relaxed">
      This QR code does not match any active restaurant branch in our database. Please verify the URL or scan the QR code printed at your table.
    </p>
    <div className="pt-4">
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center justify-center w-full py-4 px-6 bg-yellow-400 text-black font-black uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
      >
        <RefreshCw className="w-5 h-5 mr-2" /> Reload Page
      </button>
    </div>
  </div>
);

// --- Form Sub-Components ---

const RatingSlider = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
}) => (
  <div className="mb-6">
    <div className="flex justify-between items-center mb-2">
      <label className="text-sm font-bold text-black">{label}</label>
      <span className="text-xs font-black bg-yellow-400 border border-black px-2 py-0.5 rounded shadow-[2px_2px_0px_rgba(0,0,0,1)] text-black">{value} / 5</span>
    </div>
    <input
      type="range"
      min="1"
      max="5"
      step="1"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-3 bg-white border-2 border-black rounded-lg appearance-none cursor-pointer accent-black"
    />
    <div className="flex justify-between text-[10px] font-bold text-black/60 mt-1 px-1 uppercase">
      <span>Poor</span>
      <span>Excellent</span>
    </div>
  </div>
);

const StarRating = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
}) => (
  <div className="mb-6 flex flex-col items-center sm:items-start">
    {label && <label className="text-sm font-bold text-black mb-2">{label}</label>}
    <div className="flex space-x-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="transition-transform hover:-translate-y-1 focus:outline-none"
        >
          <Star
            className={cn(
              "w-10 h-10 stroke-black stroke-[1.5]",
              star <= value ? "fill-yellow-400" : "fill-white"
            )}
          />
        </button>
      ))}
    </div>
  </div>
);

const MultiChoice = ({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) => {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((o) => o !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={cn(
            "px-4 py-2 text-sm font-bold border-2 border-black transition-all",
            selected.includes(opt)
              ? "bg-yellow-400 text-black shadow-[3px_3px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]"
              : "bg-white text-black hover:bg-gray-100"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
};

// --- Main Form ---

export default function FeedbackForm() {
  const searchParams = useSearchParams();
  const brandId = searchParams.get("brandId");
  const branchId = searchParams.get("branchId");

  // Validation & Loading States
  const [isValidBranch, setIsValidBranch] = useState<boolean | null>(null); // null = loading
  const [brandName, setBrandName] = useState<string>("");
  const [brandLogo, setBrandLogo] = useState<string>("");
  const [branchName, setBranchName] = useState<string>("");
  const [googleReviewLink, setGoogleReviewLink] = useState<string>("");

  // Error States
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Flow State
  const [mode, setMode] = useState<"none" | "quick" | "detailed">("none");
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Form State
  const [customer, setCustomer] = useState({ name: "", mobile: "", residingArea: "" });
  
  // Detailed State
  const [food, setFood] = useState({ taste: 5, temp: 5, portion: 5, presentation: 5, variety: 5 });
  const [service, setService] = useState({ behavior: 5, speed: 5, accuracy: 5, helpfulness: 5 });
  const [ambience, setAmbience] = useState({ cleanliness: 5, washroom: 5, music: 5, seating: 5 });
  const [billing, setBilling] = useState({ checkoutSpeed: 5, accuracy: 5 });
  const [comments, setComments] = useState("");

  // Quick State
  const [reviewConfig, setReviewConfig] = useState<any>(null);
  const [quickRating, setQuickRating] = useState(5);
  const [quickHighlights, setQuickHighlights] = useState<string[]>([]);
  const DEFAULT_QUICK_OPTIONS = ["Food Quality", "Service Speed", "Staff Behavior", "Ambience", "Value for Money", "Cleanliness"];
  const quickOptions = reviewConfig?.quick?.options ?? DEFAULT_QUICK_OPTIONS;

  // Validate QR parameters on mount
  useEffect(() => {
    async function validateAndFetch() {
      if (!brandId || !branchId) {
        setIsValidBranch(false);
        return;
      }
      try {
        const branchRef = doc(db, "branches", branchId);
        const branchSnap = await getDoc(branchRef);
        if (branchSnap.exists()) {
          const branchData = branchSnap.data();
          if (branchData.brandId === brandId) {
            setBranchName(branchData.name);
            setGoogleReviewLink(branchData.googleReviewLink || "");
            
            const brandRef = doc(db, "brands", brandId);
            const brandSnap = await getDoc(brandRef);
            let finalConfig = null;

            if (brandSnap.exists()) {
              const brandData = brandSnap.data();
              setBrandName(brandData.name);
              if (brandData.logo) {
                setBrandLogo(brandData.logo);
              }
              if (brandData.reviewConfig) {
                finalConfig = brandData.reviewConfig;
              }
            } else {
              setBrandName(brandId.charAt(0).toUpperCase() + brandId.slice(1));
            }

            // Branch reviewConfig overrides brand reviewConfig
            if (branchData.reviewConfig) {
              finalConfig = branchData.reviewConfig;
            }
            setReviewConfig(finalConfig);
            setIsValidBranch(true);
          } else {
            setIsValidBranch(false);
          }
        } else {
          setIsValidBranch(false);
        }
      } catch (err) {
        console.error("Error validating branch:", err);
        setIsValidBranch(false);
      }
    }
    validateAndFetch();
  }, [brandId, branchId]);

  const calculateAverage = (obj: Record<string, number>) => {
    const values = Object.values(obj);
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const isQuick = mode === "quick";
  const activeSections: string[] = [];
  if (!reviewConfig || reviewConfig.detailed?.food !== false) activeSections.push('food');
  if (!reviewConfig || reviewConfig.detailed?.ambience !== false) activeSections.push('ambience');
  if (!reviewConfig || reviewConfig.detailed?.service !== false) activeSections.push('service');
  if (!reviewConfig || reviewConfig.detailed?.billing !== false) activeSections.push('billing');

  const totalSteps = isQuick ? 2 : (1 + activeSections.length + 1);

  const handleNext = () => {
    setValidationError(null);
    if (!isQuick && step === 1) {
      if (!customer.name.trim()) {
        setValidationError("Name is required.");
        return;
      }
      if (!customer.mobile.trim()) {
        setValidationError("Mobile Number is required.");
        return;
      }
      const phoneRegex = /^[+]?[0-9\s-]{7,15}$/;
      if (!phoneRegex.test(customer.mobile.trim())) {
        setValidationError("Please enter a valid mobile number.");
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handlePrev = () => {
    setValidationError(null);
    if (step === 1) {
      setMode("none");
    } else {
      setStep((prev) => Math.max(prev - 1, 1));
    }
  };

  const handleSubmit = async () => {
    setValidationError(null);
    setSubmitError(null);

    // Validate phone number in Quick mode if they optional entered it
    if (isQuick && customer.mobile.trim()) {
      const phoneRegex = /^[+]?[0-9\s-]{7,15}$/;
      if (!phoneRegex.test(customer.mobile.trim())) {
        setValidationError("Please enter a valid mobile number.");
        return;
      }
    }

    setIsSubmitting(true);
    
    let feedbackData: FeedbackData;
    let overallAvg = 0;

    if (mode === "quick") {
      overallAvg = quickRating;
      feedbackData = {
        brandId: brandId || "unknown-brand",
        branchId: branchId || "unknown-branch",
        customer,
        ratings: {
          food: { taste: 0, temp: 0, portion: 0, presentation: 0, variety: 0, average: quickRating },
          service: { behavior: 0, speed: 0, accuracy: 0, helpfulness: 0, average: quickRating },
          ambience: { cleanliness: 0, washroom: 0, music: 0, seating: 0, average: quickRating },
          billing: { checkoutSpeed: 0, accuracy: 0, average: quickRating },
          overallAverage: quickRating,
        },
        feedbackText: { 
          generalComments: quickHighlights.length > 0 ? `Highlights: ${quickHighlights.join(", ")}` : ""
        },
        metadata: { source: "web_qr_quick", userAgent: navigator.userAgent },
      };
    } else {
      const activeAverages: number[] = [];
      const hasFood = !reviewConfig || reviewConfig.detailed?.food !== false;
      const hasService = !reviewConfig || reviewConfig.detailed?.service !== false;
      const hasAmbience = !reviewConfig || reviewConfig.detailed?.ambience !== false;
      const hasBilling = !reviewConfig || reviewConfig.detailed?.billing !== false;

      const foodAvg = hasFood ? calculateAverage(food) : 0;
      const serviceAvg = hasService ? calculateAverage(service) : 0;
      const ambienceAvg = hasAmbience ? calculateAverage(ambience) : 0;
      const billingAvg = hasBilling ? calculateAverage(billing) : 0;

      if (hasFood) activeAverages.push(foodAvg);
      if (hasService) activeAverages.push(serviceAvg);
      if (hasAmbience) activeAverages.push(ambienceAvg);
      if (hasBilling) activeAverages.push(billingAvg);

      overallAvg = activeAverages.length > 0 
        ? activeAverages.reduce((a, b) => a + b, 0) / activeAverages.length 
        : 5;

      feedbackData = {
        brandId: brandId || "unknown-brand",
        branchId: branchId || "unknown-branch",
        customer,
        ratings: {
          food: { ...food, average: foodAvg },
          service: { ...service, average: serviceAvg },
          ambience: { ...ambience, average: ambienceAvg },
          billing: { ...billing, average: billingAvg },
          overallAverage: overallAvg,
        },
        feedbackText: { generalComments: comments },
        metadata: { source: "web_qr_detailed", userAgent: navigator.userAgent },
      };
    }

    const res = await submitFeedback(feedbackData);
    setIsSubmitting(false);
    if (res.success) {
      setIsSubmitted(true);
    } else {
      setSubmitError("Could not submit feedback. Please check your connection and try again.");
    }
  };

  const activeAverages: number[] = [];
  const hasFood = !reviewConfig || reviewConfig.detailed?.food !== false;
  const hasService = !reviewConfig || reviewConfig.detailed?.service !== false;
  const hasAmbience = !reviewConfig || reviewConfig.detailed?.ambience !== false;
  const hasBilling = !reviewConfig || reviewConfig.detailed?.billing !== false;

  if (hasFood) activeAverages.push(calculateAverage(food));
  if (hasService) activeAverages.push(calculateAverage(service));
  if (hasAmbience) activeAverages.push(calculateAverage(ambience));
  if (hasBilling) activeAverages.push(calculateAverage(billing));

  const finalScore = mode === "quick" 
    ? quickRating 
    : (activeAverages.length > 0 ? activeAverages.reduce((a, b) => a + b, 0) / activeAverages.length : 5);

  if (isValidBranch === null) {
    return <LoadingSkeleton />;
  }

  if (isValidBranch === false) {
    return <InvalidQRScreen />;
  }

  if (isSubmitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-auto p-8 bg-white border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] text-center relative"
      >
        <motion.div 
          initial={{ scale: 0 }} 
          animate={{ scale: 1 }} 
          transition={{ type: "spring", delay: 0.2 }}
          className="flex justify-center mb-6 items-center gap-4"
        >
          {brandLogo && (
            <img 
              src={brandLogo} 
              alt={`${brandName} Logo`} 
              className="w-16 h-16 border-4 border-black object-contain bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-full" 
            />
          )}
          <div className="w-16 h-16 bg-yellow-400 rounded-full border-4 border-black flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-black" />
          </div>
        </motion.div>
        <h2 className="text-3xl font-black text-black mb-2 uppercase">Thank You!</h2>
        <p className="text-black font-medium mb-8">Your feedback helps us serve you better.</p>
        
        {finalScore >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <p className="text-sm font-bold text-black mb-4 uppercase">You seem to have had a great time!</p>
            <a 
              href={googleReviewLink || "https://g.page/r/google-review-link"} 
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center w-full py-4 px-6 bg-yellow-400 text-black font-black uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
            >
              <Star className="w-5 h-5 mr-2 fill-black" />
              Rate us on Google
            </a>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // Initial Mode Selection
  if (mode === "none") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto space-y-6"
      >
        {brandName && (
          <div className="text-center mb-4 bg-white border-2 border-black p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center">
            {brandLogo && (
              <img 
                src={brandLogo} 
                alt={`${brandName} Logo`} 
                className="w-16 h-16 mb-3 border-2 border-black object-contain bg-white shadow-[3px_3px_0px_rgba(0,0,0,1)] rounded-full" 
              />
            )}
            <span className="text-xs font-black uppercase tracking-wider text-black">
              Reviewing {brandName}
            </span>
            <p className="text-[11px] font-bold text-black/60 uppercase mt-0.5">{branchName}</p>
          </div>
        )}

        <button
          onClick={() => { setMode("quick"); setStep(1); }}
          className="w-full p-6 bg-yellow-400 border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 transition-all group text-left"
        >
          <div className="flex items-center">
            <div className="w-14 h-14 bg-white border-2 border-black flex items-center justify-center mr-4 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <Zap className="w-7 h-7 text-black" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-black mb-1 uppercase tracking-tight">Quick Review</h3>
              <p className="text-sm font-bold text-black/70">Takes 30 seconds. A few taps!</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => { setMode("detailed"); setStep(1); }}
          className="w-full p-6 bg-white border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:bg-gray-50 hover:shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 transition-all group text-left"
        >
          <div className="flex items-center">
            <div className="w-14 h-14 bg-yellow-400 border-2 border-black flex items-center justify-center mr-4 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <FileText className="w-7 h-7 text-black" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-black mb-1 uppercase tracking-tight">Detailed Review</h3>
              <p className="text-sm font-bold text-black/70">Tell us every detail in depth.</p>
            </div>
          </div>
        </button>
      </motion.div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Progress Bar */}
      <div className="flex justify-between items-center mb-10 px-2 relative">
        {/* Background line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-black z-0" />
        
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className="flex flex-col items-center relative z-10">
            <div className={cn(
              "w-10 h-10 flex items-center justify-center text-sm font-black border-2 border-black transition-all",
              step >= i + 1 
                ? "bg-yellow-400 text-black shadow-[3px_3px_0px_rgba(0,0,0,1)] scale-110" 
                : "bg-white text-black"
            )}>
              {i + 1}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border-4 border-black p-6 sm:p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] relative">
        {brandName && (
          <div className="mb-6 pb-4 border-b-2 border-black flex justify-between items-center">
            <div className="flex items-center gap-3">
              {brandLogo && (
                <img 
                  src={brandLogo} 
                  alt={`${brandName} Logo`} 
                  className="w-10 h-10 border-2 border-black object-contain bg-white shadow-[2px_2px_0px_rgba(0,0,0,1)] rounded-full" 
                />
              )}
              <div>
                <p className="text-[10px] font-black uppercase text-black/60 tracking-wider">Reviewing</p>
                <h4 className="text-md font-black uppercase text-black">{brandName}</h4>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase bg-black text-white px-2 py-1 shadow-[2px_2px_0px_rgba(250,204,21,1)]">
              {branchName}
            </span>
          </div>
        )}

        {/* Validation or Submission Errors */}
        {validationError && (
          <div className="mb-6 p-4 bg-yellow-100 border-2 border-black text-black font-bold text-xs shadow-[3px_3px_0px_rgba(0,0,0,1)] flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-black flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {submitError && (
          <div className="mb-6 p-4 bg-red-100 border-2 border-black text-black font-bold text-xs shadow-[3px_3px_0px_rgba(0,0,0,1)] flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-red-600 flex-shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ----------------- QUICK MODE ----------------- */}
          {isQuick && step === 1 && (
            <motion.div
              key="quick-step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-2xl font-black text-black mb-2 uppercase">How was it? 🌟</h2>
                <p className="text-black font-medium mb-6">Rate your overall experience</p>
                <div className="flex justify-center bg-gray-50 border-2 border-black p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                  <StarRating label="" value={quickRating} onChange={setQuickRating} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-black mb-4 uppercase">What stood out to you?</h3>
                <MultiChoice options={quickOptions} selected={quickHighlights} onChange={setQuickHighlights} />
              </div>
            </motion.div>
          )}

          {isQuick && step === 2 && (
            <motion.div
              key="quick-step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-black text-black mb-2 uppercase">Almost done! 🚀</h2>
              <p className="text-black font-medium mb-6">Provide your details (optional)</p>
              <div className="space-y-4">
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="Name"
                  className="w-full bg-white border-2 border-black p-4 text-black font-bold placeholder:text-gray-400 focus:outline-none focus:bg-yellow-50 focus:shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all"
                />
                <input
                  type="tel"
                  value={customer.mobile}
                  onChange={(e) => setCustomer({ ...customer, mobile: e.target.value })}
                  placeholder="Mobile Number"
                  className="w-full bg-white border-2 border-black p-4 text-black font-bold placeholder:text-gray-400 focus:outline-none focus:bg-yellow-50 focus:shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all"
                />
              </div>
            </motion.div>
          )}

          {/* ----------------- DETAILED MODE ----------------- */}
          {!isQuick && step === 1 && (
            <motion.div
              key="det-step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <h2 className="text-2xl font-black text-black mb-6 uppercase">Welcome! 👋</h2>
              <div>
                <label className="block text-sm font-black text-black mb-2 uppercase">Name</label>
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full bg-white border-2 border-black p-4 text-black font-bold placeholder:text-gray-400 focus:outline-none focus:bg-yellow-50 focus:shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-black mb-2 uppercase">Mobile Number</label>
                <input
                  type="tel"
                  value={customer.mobile}
                  onChange={(e) => setCustomer({ ...customer, mobile: e.target.value })}
                  placeholder="+1 234 567 8900"
                  className="w-full bg-white border-2 border-black p-4 text-black font-bold placeholder:text-gray-400 focus:outline-none focus:bg-yellow-50 focus:shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-black mb-2 uppercase">Residing Area <span className="text-gray-500 font-medium text-xs">(Optional)</span></label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 w-5 h-5 text-black" />
                  <input
                    type="text"
                    value={customer.residingArea}
                    onChange={(e) => setCustomer({ ...customer, residingArea: e.target.value })}
                    placeholder="Downtown"
                    className="w-full bg-white border-2 border-black pl-12 pr-4 py-4 text-black font-bold placeholder:text-gray-400 focus:outline-none focus:bg-yellow-50 focus:shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {!isQuick && step > 1 && step < totalSteps && (() => {
            const currentSection = activeSections[step - 2];
            if (currentSection === "food") {
              return (
                <motion.div
                  key="det-food"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar space-y-6"
                >
                  <div className="p-5 border-2 border-black bg-yellow-400/20 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-lg font-black text-black mb-4 flex items-center uppercase"><Star className="w-5 h-5 mr-2 fill-black" /> Food Quality</h3>
                    <RatingSlider label="Taste" value={food.taste} onChange={(v) => setFood({ ...food, taste: v })} />
                    <RatingSlider label="Temperature" value={food.temp} onChange={(v) => setFood({ ...food, temp: v })} />
                    <RatingSlider label="Portion Size" value={food.portion} onChange={(v) => setFood({ ...food, portion: v })} />
                    <RatingSlider label="Presentation" value={food.presentation} onChange={(v) => setFood({ ...food, presentation: v })} />
                    <RatingSlider label="Variety" value={food.variety} onChange={(v) => setFood({ ...food, variety: v })} />
                  </div>
                </motion.div>
              );
            }
            if (currentSection === "ambience") {
              return (
                <motion.div
                  key="det-ambience"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar space-y-6"
                >
                  <div className="p-5 border-2 border-black bg-gray-50 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-lg font-black text-black mb-4 flex items-center uppercase"><Star className="w-5 h-5 mr-2 fill-black" /> Ambience</h3>
                    <StarRating label="Cleanliness" value={ambience.cleanliness} onChange={(v) => setAmbience({ ...ambience, cleanliness: v })} />
                    <StarRating label="Washroom" value={ambience.washroom} onChange={(v) => setAmbience({ ...ambience, washroom: v })} />
                    <StarRating label="Music" value={ambience.music} onChange={(v) => setAmbience({ ...ambience, music: v })} />
                    <StarRating label="Seating" value={ambience.seating} onChange={(v) => setAmbience({ ...ambience, seating: v })} />
                  </div>
                </motion.div>
              );
            }
            if (currentSection === "service") {
              return (
                <motion.div
                  key="det-service"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar space-y-6"
                >
                  <div className="p-5 border-2 border-black bg-yellow-400/20 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-lg font-black text-black mb-4 uppercase">Service</h3>
                    <RatingSlider label="Overall Behavior" value={service.behavior} onChange={(v) => setService({ ...service, behavior: v })} />
                    <RatingSlider label="Speed of Service" value={service.speed} onChange={(v) => setService({ ...service, speed: v })} />
                    <RatingSlider label="Accuracy of Order" value={service.accuracy} onChange={(v) => setService({ ...service, accuracy: v })} />
                    <RatingSlider label="Helpfulness" value={service.helpfulness} onChange={(v) => setService({ ...service, helpfulness: v })} />
                  </div>
                </motion.div>
              );
            }
            if (currentSection === "billing") {
              return (
                <motion.div
                  key="det-billing"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar space-y-6"
                >
                  <div className="p-5 border-2 border-black bg-gray-50 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-lg font-black text-black mb-4 uppercase">Billing Experience</h3>
                    <StarRating label="Checkout Speed" value={billing.checkoutSpeed} onChange={(v) => setBilling({ ...billing, checkoutSpeed: v })} />
                    <StarRating label="Accuracy" value={billing.accuracy} onChange={(v) => setBilling({ ...billing, accuracy: v })} />
                  </div>
                </motion.div>
              );
            }
            return null;
          })()}

          {!isQuick && step === totalSteps && (
            <motion.div
              key="det-step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-black text-black mb-2 uppercase">Detailed Comments 💬</h2>
              <p className="text-black font-medium mb-6">Provide an in-depth review of your experience.</p>
              
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="What did you love? What can we improve? Write as much as you want."
                rows={6}
                className="w-full bg-white border-2 border-black p-4 text-black font-bold placeholder:text-gray-400 focus:outline-none focus:bg-yellow-50 focus:shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all resize-none"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="mt-10 flex gap-4">
          <button
            onClick={handlePrev}
            className="flex-1 py-4 px-4 bg-white border-2 border-black text-black font-black uppercase tracking-wider shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5 mr-1" /> Back
          </button>
          
          {step < totalSteps ? (
            <button
              onClick={handleNext}
              className="flex-[2] py-4 px-4 bg-yellow-400 border-2 border-black text-black font-black uppercase tracking-wider shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center justify-center"
            >
              Next <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-[2] py-4 px-4 bg-black border-2 border-black text-white font-black uppercase tracking-wider shadow-[4px_4px_0px_rgba(250,204,21,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Submit <Send className="w-4 h-4 ml-2" /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
