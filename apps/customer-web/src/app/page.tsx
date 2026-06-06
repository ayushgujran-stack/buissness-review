import { Suspense } from "react";
import FeedbackForm from "@/components/FeedbackForm";
import { Utensils } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative bg-white overflow-hidden">
      {/* Background decoration - solid subtle geometric lines if needed, but keeping it solid white per request */}
      
      <div className="z-10 w-full flex flex-col items-center mb-8 pt-8">
        <div className="w-16 h-16 bg-yellow-400 border-4 border-black rounded-2xl flex items-center justify-center mb-6 shadow-[4px_4px_0px_rgba(0,0,0,1)] transform -rotate-6 transition-transform hover:rotate-0">
          <Utensils className="w-8 h-8 text-black" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-black text-center tracking-tight uppercase">
          How was your meal?
        </h1>
      </div>

      <div className="w-full z-10 pb-12">
        <Suspense fallback={<div className="text-center text-black/50 animate-pulse font-bold">Loading form...</div>}>
          <FeedbackForm />
        </Suspense>
      </div>
    </main>
  );
}
