"use client";
import { useTranslation, Language } from "../i18n";
import { Globe } from "lucide-react";

export default function LanguageSelector() {
  const { lang, changeLanguage } = useTranslation();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 border border-slate-700 px-4 py-2 rounded-full shadow-2xl backdrop-blur-xl">
        <Globe className="w-4 h-4 text-blue-400" />
        <select 
           value={lang} 
           onChange={(e) => changeLanguage(e.target.value as Language)}
           className="bg-transparent text-sm font-bold text-slate-300 focus:outline-none cursor-pointer"
        >
            <option value="uk" className="bg-slate-900">UA (Українська)</option>
            <option value="en" className="bg-slate-900">EN (English)</option>
            <option value="es" className="bg-slate-900">ES (Español)</option>
            <option value="tr" className="bg-slate-900">TR (Türkçe)</option>
            <option value="be" className="bg-slate-900">BE (Belgian)</option>
        </select>
    </div>
  );
}
