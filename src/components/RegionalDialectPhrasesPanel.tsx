import React, { useState, useMemo } from 'react';
import {
  Languages,
  Search,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Share2,
  Compass,
  Mountain,
  MapPin,
  Sparkles,
  BookOpen,
  Info,
  ChevronRight,
  Filter,
  MessageCircle,
  HelpCircle,
} from 'lucide-react';
import {
  NEPAL_DIALECTS,
  TRANSIT_PHRASE_CATEGORIES,
  REGIONAL_TRANSIT_PHRASES,
  DialectInfo,
  PhraseCategory,
  RegionalPhrase,
} from '../data/regionalDialectPhrasesData';

interface RegionalDialectPhrasesPanelProps {
  selectedProvince?: string;
  onNavigateToRoute?: () => void;
}

export const RegionalDialectPhrasesPanel: React.FC<RegionalDialectPhrasesPanelProps> = ({
  selectedProvince,
  onNavigateToRoute,
}) => {
  const [selectedDialectId, setSelectedDialectId] = useState<string>('doteli');
  const [selectedCategory, setSelectedCategory] = useState<PhraseCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedPhraseId, setCopiedPhraseId] = useState<string | null>(null);
  const [speakingPhraseId, setSpeakingPhraseId] = useState<string | null>(null);
  const [activeTabMode, setActiveTabMode] = useState<'phrases' | 'dialects_guide'>('phrases');

  // Selected Dialect Info
  const activeDialect = useMemo(() => {
    return NEPAL_DIALECTS.find((d) => d.id === selectedDialectId) || NEPAL_DIALECTS[0];
  }, [selectedDialectId]);

  // Filtered Phrases
  const filteredPhrases = useMemo(() => {
    return REGIONAL_TRANSIT_PHRASES.filter((p) => {
      // Category filter
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesEnglish = p.english.toLowerCase().includes(q);
        const matchesNepali = p.standardNepali.toLowerCase().includes(q) || p.standardNepaliRomanized.toLowerCase().includes(q);
        const translation = p.translations[selectedDialectId];
        const matchesDialect =
          translation &&
          (translation.text.toLowerCase().includes(q) ||
            translation.romanized.toLowerCase().includes(q));

        return matchesEnglish || matchesNepali || matchesDialect;
      }

      return true;
    });
  }, [selectedCategory, searchQuery, selectedDialectId]);

  // Speech synthesis for Nepali phrases
  const handleSpeak = (phraseId: string, textToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    setSpeakingPhraseId(phraseId);

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.85; // slightly slower for clear pronunciation
    utterance.pitch = 1.0;
    utterance.lang = 'ne-NP';

    utterance.onend = () => {
      setSpeakingPhraseId(null);
    };

    utterance.onerror = () => {
      setSpeakingPhraseId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Copy phrase to clipboard
  const handleCopy = (phrase: RegionalPhrase) => {
    const translation = phrase.translations[selectedDialectId];
    const dialectText = translation ? `${translation.text} (${translation.romanized})` : '';
    const textToCopy = `🗣️ Nepali Transit Phrase:\n🇬🇧 English: ${phrase.english}\n🇳🇵 Nepali: ${phrase.standardNepali} (${phrase.standardNepaliRomanized})\n📍 ${activeDialect.name}: ${dialectText || phrase.standardNepali}\n\nShared via Mero Sadak Nepal GIS`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedPhraseId(phrase.id);
    setTimeout(() => {
      setCopiedPhraseId(null);
    }, 2000);
  };

  // Share phrase via Web Share API or fallback to WhatsApp
  const handleShare = (phrase: RegionalPhrase) => {
    const translation = phrase.translations[selectedDialectId];
    const dialectText = translation ? `${translation.text} (${translation.romanized})` : '';
    const shareText = `🗣️ ${phrase.english}\n🇳🇵 ${phrase.standardNepali}\n📍 ${activeDialect.name}: ${dialectText || phrase.standardNepali}`;

    if (navigator.share) {
      navigator.share({
        title: 'Mero Sadak Regional Nepali Transit Phrase',
        text: shareText,
      }).catch(() => {});
    } else {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-6 pb-8" id="regional-dialect-phrasebook">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-800/40 rounded-3xl p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center space-x-1.5">
                <Languages className="w-3.5 h-3.5" />
                <span>Nepal Regional Dialects & Transit Phrasebook</span>
              </span>
              <span className="text-xs text-slate-400 font-medium">१०+ प्रादेशिक भाषाहरू</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Highway Transit Communication & Local Dialects
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Navigate Nepal's highways confidently with authentic regional transit phrases, road navigation inquiries, mechanic help, and respectful cultural greetings across all 7 provinces.
            </p>
          </div>

          {/* Quick View Mode Toggle */}
          <div className="flex items-center space-x-2 bg-slate-950/70 p-1 rounded-2xl border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTabMode('phrases')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTabMode === 'phrases'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Transit Phrases</span>
            </button>
            <button
              onClick={() => setActiveTabMode('dialects_guide')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTabMode === 'dialects_guide'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Provinces Guide</span>
            </button>
          </div>
        </div>
      </div>

      {activeTabMode === 'phrases' ? (
        <>
          {/* Dialect Selector Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Languages className="w-3.5 h-3.5 text-emerald-400" />
                <span>Select Target Regional Dialect / Highway Corridor:</span>
              </span>
              <span className="text-xs text-emerald-400 font-semibold">
                Active: {activeDialect.name} ({activeDialect.nativeName})
              </span>
            </div>

            {/* Horizontal Dialect Buttons with Wrapping */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {NEPAL_DIALECTS.map((dialect) => {
                const isSelected = selectedDialectId === dialect.id;
                return (
                  <button
                    key={dialect.id}
                    onClick={() => setSelectedDialectId(dialect.id)}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-lg ring-1 ring-emerald-500'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-black block text-white">{dialect.name}</span>
                      <span className="text-[11px] text-emerald-400 font-medium">{dialect.nativeName}</span>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-400 truncate">
                      {dialect.provinces.join(', ')}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Dialect Quick Card */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs text-slate-300">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Corridors & Key Hubs</span>
                <p className="font-semibold text-white">{activeDialect.keyRegions.join(' • ')}</p>
                <p className="text-[11px] text-emerald-400">{activeDialect.primaryHighways.join(', ')}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Local Greeting & Thank You</span>
                <p className="font-medium text-white">
                  Greeting: <strong className="text-amber-300">{activeDialect.greeting}</strong>
                </p>
                <p className="font-medium text-white">
                  Thanks: <strong className="text-emerald-300">{activeDialect.thankYou}</strong>
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Cultural & Etiquette Tip</span>
                <p className="text-[11px] text-slate-300 leading-snug">{activeDialect.culturalTip}</p>
              </div>
            </div>
          </div>

          {/* Categories & Search Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transit phrase (e.g. mechanic, landslide, tea, bus fare, petrol, direction)..."
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Pills Slider / Filter */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 max-w-full">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                All Topics ({REGIONAL_TRANSIT_PHRASES.length})
              </button>
              {TRANSIT_PHRASE_CATEGORIES.map((cat) => {
                const count = REGIONAL_TRANSIT_PHRASES.filter((p) => p.category === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label.split(' ')[0]}</span>
                    <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Phrases Grid List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPhrases.map((phrase) => {
              const translation = phrase.translations[selectedDialectId];
              const categoryConfig = TRANSIT_PHRASE_CATEGORIES.find((c) => c.id === phrase.category);
              const isCopied = copiedPhraseId === phrase.id;
              const isSpeaking = speakingPhraseId === phrase.id;

              return (
                <div
                  key={phrase.id}
                  className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-3xl p-5 shadow-lg flex flex-col justify-between transition-all group hover:shadow-xl hover:shadow-emerald-950/20"
                >
                  <div className="space-y-3.5">
                    {/* Category Badge & Actions */}
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 flex items-center space-x-1">
                        <span>{categoryConfig?.icon}</span>
                        <span>{categoryConfig?.label}</span>
                      </span>

                      <div className="flex items-center space-x-1.5">
                        {/* Audio Speak */}
                        <button
                          onClick={() => handleSpeak(phrase.id, translation?.text || phrase.standardNepali)}
                          className={`p-1.5 rounded-lg text-xs transition-colors ${
                            isSpeaking
                              ? 'bg-emerald-500 text-slate-950 animate-pulse'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                          }`}
                          title="Listen to pronunciation (Speech Audio)"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>

                        {/* Copy button */}
                        <button
                          onClick={() => handleCopy(phrase)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
                          title="Copy phrase"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>

                        {/* Share */}
                        <button
                          onClick={() => handleShare(phrase)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
                          title="Share phrase"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* English Meaning */}
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight leading-snug">
                        {phrase.english}
                      </h3>
                    </div>

                    {/* Standard Nepali Version */}
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Standard Nepali (मानक नेपाली)
                      </span>
                      <p className="text-sm font-bold text-slate-200">{phrase.standardNepali}</p>
                      <p className="text-xs text-slate-400 italic font-mono">{phrase.standardNepaliRomanized}</p>
                    </div>

                    {/* Selected Regional Dialect Translation */}
                    <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                          {activeDialect.name} ({activeDialect.nativeName})
                        </span>
                        {translation?.note && (
                          <span className="text-[10px] text-amber-300 font-medium">{translation.note}</span>
                        )}
                      </div>
                      <p className="text-sm font-extrabold text-white">
                        {translation ? translation.text : phrase.standardNepali}
                      </p>
                      <p className="text-xs text-emerald-300/80 italic font-mono">
                        {translation ? translation.romanized : phrase.standardNepaliRomanized}
                      </p>
                    </div>

                    {/* Context Tip if available */}
                    {phrase.contextTip && (
                      <div className="flex items-start space-x-1.5 text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-800/30 rounded-xl p-2">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{phrase.contextTip}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPhrases.length === 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
              <Search className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No transit phrases matched your search</h3>
              <p className="text-xs text-slate-400">
                Try searching for words like "pairo", "mechanic", "petrol", "hotel", "bhaada", or change category.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition"
              >
                Reset Search Filters
              </button>
            </div>
          )}
        </>
      ) : (
        /* Dialects & Provinces Cultural Guide */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {NEPAL_DIALECTS.map((dialect) => (
            <div
              key={dialect.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg space-y-4 hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">{dialect.name}</h3>
                  <span className="text-xs font-semibold text-emerald-400">{dialect.nativeName}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${dialect.badgeColor}`}>
                  {dialect.provinces.join(' • ')}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 space-y-1">
                  <p>
                    <strong className="text-slate-400">Highways:</strong> {dialect.primaryHighways.join(', ')}
                  </p>
                  <p>
                    <strong className="text-slate-400">Major Hubs:</strong> {dialect.keyRegions.join(', ')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Greeting</span>
                    <p className="font-bold text-amber-300 mt-0.5">{dialect.greeting}</p>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Thank You</span>
                    <p className="font-bold text-emerald-300 mt-0.5">{dialect.thankYou}</p>
                  </div>
                </div>

                <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-3">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">
                    Cultural Nuance & Respect
                  </span>
                  <p className="text-[11px] leading-relaxed text-slate-300">{dialect.culturalTip}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedDialectId(dialect.id);
                  setActiveTabMode('phrases');
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                <span>Browse {dialect.name} Phrases</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
