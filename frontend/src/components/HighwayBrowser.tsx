import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Globe, MapPin, Navigation, ArrowRight, ChevronRight, Hash, ArrowDownWideNarrow, Ruler, Shield, Share2, Scale, CheckCircle2, Trophy, Download, History, Play, Pause, Target, Fuel, Activity, BarChart3, Utensils, Stethoscope, AlertTriangle, FileText } from 'lucide-react';
import { apiFetch } from '../api';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface HighwayBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (code: string) => void;
}

export const HighwayBrowser: React.FC<HighwayBrowserProps> = ({ isOpen, onClose, onSelect }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const [highways, setHighways] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortByLength, setSortByLength] = useState(false);
  const [filterHighSafety, setFilterHighSafety] = useState(false);
  const [showRegionalLeaderboard, setShowRegionalLeaderboard] = useState(false);
  const [selectedProvinceForLeaderboard, setSelectedProvinceForLeaderboard] = useState<string | null>(null);
  const [selectedHighwayForDetails, setSelectedHighwayForDetails] = useState<any | null>(null);
  const [compareList, setCompareList] = useState<any[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const lastAlertDistrictRef = useRef<string | null>(null);

  // 🎬 Route Simulation State
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [showWeatherLayer, setShowWeatherLayer] = useState(false);
  const [isNightSimulation, setIsNightSimulation] = useState(false);

  useEffect(() => {
    let interval: any;
    if (isVideoPlaying) {
      interval = setInterval(() => {
        setVideoProgress(prev => {
          if (prev >= 100) {
            setIsVideoPlaying(false);
            return 0;
          }
          return prev + 0.5;
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isVideoPlaying]);

  useEffect(() => {
    if (isOpen) {
      const fetchList = async () => {
        setIsLoading(true);
        const res = await apiFetch('/v1/highways/list');
        if (res.data) setHighways(res.data);
        setIsLoading(false);
      };
      fetchList();
    }
  }, [isOpen]);

  // Helper to determine Safety Grade based on infrastructure quality
  const getSafetyGrade = (score: number = 0) => {
    if (score >= 80) return { grade: 'A', color: 'bg-emerald-500', text: 'text-emerald-500' };
    if (score >= 60) return { grade: 'B', color: 'bg-indigo-500', text: 'text-indigo-500' };
    if (score >= 40) return { grade: 'C', color: 'bg-amber-500', text: 'text-amber-500' };
    if (score >= 20) return { grade: 'D', color: 'bg-orange-500', text: 'text-orange-500' };
    return { grade: 'F', color: 'bg-rose-500', text: 'text-rose-500' };
  };

  const nationalLeaderboard = useMemo(() => {
    return [...highways].sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
  }, [highways]);

  const getNationalRank = (code: string) => {
    const index = nationalLeaderboard.findIndex(h => h.code === code);
    return index !== -1 ? index + 1 : null;
  };

  // 📈 Mock Safety Timeline Data
  const mockTimeline = useMemo(() => {
    if (!selectedHighwayForDetails) return [];
    const base = selectedHighwayForDetails.qualityScore || 60;
    return [
      { label: '6M ago', score: Math.max(0, base - 8) },
      { label: '3M ago', score: Math.max(0, base - 3) },
      { label: 'Now', score: base }
    ];
  }, [selectedHighwayForDetails]);

  // Get unique provinces for the dropdown in the regional leaderboard
  const uniqueProvinces = useMemo(() => {
    const provinces = new Set<string>();
    highways.forEach(h => {
      if (h.provinces && Array.isArray(h.provinces)) {
        h.provinces.forEach((p: string) => provinces.add(p));
      }
    });
    return Array.from(provinces).sort();
  }, [highways]);

  const processedHighways = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let result = highways.filter(h =>
      h.code.toLowerCase().includes(q) ||
      (h.name && h.name.toLowerCase().includes(q)) ||
      (h.districts && Array.isArray(h.districts) && h.districts.some((d: string) => d.toLowerCase().includes(q))) ||
      (h.provinces && Array.isArray(h.provinces) && h.provinces.some((p: string) => p.toLowerCase().includes(q)))
    );

    if (filterHighSafety) {
      result = result.filter(h => (h.qualityScore || 0) >= 60);
    }

    if (sortByLength) {
      result = [...result].sort((a, b) => (b.lengthKm || 0) - (a.lengthKm || 0));
    }

    return result;
  }, [highways, searchQuery, sortByLength, filterHighSafety]);

  // 🏔️ Landslide Risk Heat Map Generator
  const riskHeatMapGradient = useMemo(() => {
    if (!selectedHighwayForDetails?.districts?.length) return '';
    const districts = selectedHighwayForDetails.districts;
    const riskDistricts = ["Dhading", "Makwanpur", "Sindhupalchok", "Kavrepalanchok", "Gorkha", "Mugling", "Kalikot", "Jumla", "Myagdi"];

    const stops = districts.map((dist: string, i: number) => {
      const isRisk = riskDistricts.includes(dist);
      // Red for high risk, subtle emerald for low risk
      const color = isRisk ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.1)';
      const start = (i / districts.length) * 100;
      const end = ((i + 1) / districts.length) * 100;
      return `${color} ${start}%, ${color} ${end}%`;
    });

    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [selectedHighwayForDetails]);

  // 🌧️ Weather (Precipitation) Heat Map Generator
  const weatherHeatMapGradient = useMemo(() => {
    if (!selectedHighwayForDetails?.districts?.length) return '';
    const districts = selectedHighwayForDetails.districts;

    const stops = districts.map((dist: string, i: number) => {
      // Deterministic precipitation simulation based on district index
      const prob = (i % 3 === 0) ? 0.8 : (i % 2 === 0) ? 0.4 : 0.1;
      const color = `rgba(59, 130, 246, ${prob * 0.7})`;
      const start = (i / districts.length) * 100;
      const end = ((i + 1) / districts.length) * 100;
      return `${color} ${start}%, ${color} ${end}%`;
    });

    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [selectedHighwayForDetails]);

  // 🔊 Mission Audio Log: Automatic briefing at simulation start
  useEffect(() => {
    if (isVideoPlaying && videoProgress < 1 && selectedHighwayForDetails) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const objList = missionObjectives.map(o => o.title).join(', ');
        const text = `Initializing virtual mission briefing for ${selectedHighwayForDetails.code}. Primary objectives: ${objList}. Standby for sector-by-sector terrain hazard analysis.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 0.85;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [isVideoPlaying]);

  // 📑 Export Tactical Mission Briefing as PDF
  const handleExportTacticalBriefing = () => {
    if (!selectedHighwayForDetails) return;
    const doc = new jsPDF();
    const h = selectedHighwayForDetails;
    const grade = getSafetyGrade(h.qualityScore);
    const date = new Date().toLocaleDateString();
    const isNight = isNightSimulation;

    // Background & Theme
    doc.setFillColor(isNight ? 0 : 15, isNight ? 0 : 23, isNight ? 0 : 42);
    doc.rect(0, 0, 210, 297, 'F');

    // Primary Accent (Indigo or High-Contrast Red)
    const r = isNight ? 220 : 99;
    const g = isNight ? 38 : 102;
    const b = isNight ? 38 : 241;

    doc.setTextColor(r, g, b);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("TACTICAL MISSION BRIEFING", 20, 30);

    // 🛡️ Mission Patch Watermark (Varies by Highway Type)
    const isNH = h.code.startsWith('NH');
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.5);
    doc.circle(180, 25, 15, 'S'); // Outer Ring

    doc.setLineDashPattern([1, 1], 0);
    doc.circle(180, 25, 13.5, 'S'); // Decorative Inner Ring
    doc.setLineDashPattern([], 0);

    doc.setFontSize(5);
    doc.text(isNH ? "NATIONAL" : "STRATEGIC", 180, 21, { align: "center" });
    doc.setFontSize(10);
    doc.text(h.code, 180, 27, { align: "center" });
    doc.setFontSize(4);
    doc.text(isNH ? "INTERSTATE CORRIDOR" : "REGIONAL FEEDER", 180, 32, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(isNight ? 153 : 148, isNight ? 27 : 163, isNight ? 27 : 184); // red-800 or slate-400
    doc.text(`CONFIDENTIAL // MEROSADAK OPERATIONAL INTEL`, 20, 38);
    doc.text(`SYSTEM DATE: ${date}`, 145, 38);

    // Primary Metadata
    doc.setDrawColor(r, g, b);
    doc.line(20, 42, 190, 42);

    doc.setTextColor(isNight ? 239 : 255, isNight ? 68 : 255, isNight ? 68 : 255); // red-500 or white
    doc.setFontSize(16);
    doc.text(`${h.code} - ${h.name || 'STRATEGIC CORRIDOR'}`, 20, 55);

    doc.setFontSize(10);
    doc.text(`SAFETY RATING: ${h.qualityScore}% [GRADE ${grade.grade}]`, 20, 65);
    doc.text(`NATIONAL RANK: #${getNationalRank(h.code)} OF ${highways.length}`, 20, 72);
    doc.text(`OPERATIONAL LENGTH: ${h.lengthKm} KM`, 20, 79);

    // Objectives
    doc.setTextColor(r, g, b);
    doc.setFontSize(12);
    doc.text("MISSION OBJECTIVES", 20, 95);

    doc.setTextColor(isNight ? 185 : 255, isNight ? 28 : 255, isNight ? 28 : 255); // red-700 or white

    doc.setFontSize(9);
    missionObjectives.forEach((obj, i) => {
      doc.text(`[OBJ ${i + 1}] ${obj.title.toUpperCase()}: ${obj.description}`, 25, 105 + (i * 10));
    });

    // Sector Hazard Matrix
    const startY = 145;
    doc.setTextColor(r, g, b);
    doc.setFontSize(12);
    doc.text("SECTOR HAZARD MATRIX", 20, startY);

    doc.setFillColor(isNight ? 40 : 30, isNight ? 0 : 41, isNight ? 0 : 59); // very dark red or slate-900
    doc.rect(20, startY + 5, 170, 8, 'F');

    doc.setFontSize(8);
    doc.setTextColor(isNight ? 220 : 255, isNight ? 38 : 255, isNight ? 38 : 255);
    doc.text("SECTOR ID / DISTRICT", 25, startY + 10);
    doc.text("TERRAIN RISK", 85, startY + 10);
    doc.text("PRECIPITATION", 145, startY + 10);

    const riskDistricts = ["Dhading", "Makwanpur", "Sindhupalchok", "Kavrepalanchok", "Gorkha", "Mugling", "Kalikot", "Jumla", "Myagdi"];
    h.districts.forEach((dist: string, i: number) => {
      const y = startY + 22 + (i * 8);
      if (y > 280) return;

      doc.setFontSize(8);
      doc.setTextColor(isNight ? 153 : 148, isNight ? 27 : 163, isNight ? 27 : 184);
      doc.text(dist.toUpperCase(), 25, y);

      const isRisk = riskDistricts.includes(dist);
      if (isNight) {
        doc.setTextColor(isRisk ? 239 : 185, isRisk ? 68 : 28, isRisk ? 68 : 28);
      } else {
        doc.setTextColor(isRisk ? 239 : 16, isRisk ? 68 : 185, isRisk ? 68 : 129);
      }
      doc.text(isRisk ? "CRITICAL" : "STABLE", 85, y);

      const precip = (i % 3 === 0) ? "HIGH" : (i % 2 === 0) ? "MODERATE" : "LOW";
      doc.setTextColor(isNight ? 220 : 255, isNight ? 38 : 255, isNight ? 38 : 255);
      doc.text(precip, 145, y);
    });

    const prefix = isNight ? "MS_TACTICAL_NIGHT_" : "MS_TACTICAL_";
    doc.save(`${prefix}${h.code}.pdf`);
  };

  const handleToggleCompare = (highway: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (compareList.find(h => h.code === highway.code)) {
      setCompareList(prev => prev.filter(h => h.code !== highway.code));
    } else if (compareList.length < 2) {
      setCompareList(prev => [...prev, highway]);
    }
  };

  // 🎨 Generate Summary Image using Canvas for sharing
  const handleShareHighway = (highway: any) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gradeInfo = getSafetyGrade(highway.qualityScore);

    // Background Styling
    const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 630);

    // Safety Grade Visual
    ctx.beginPath();
    ctx.arc(1000, 315, 120, 0, Math.PI * 2);
    ctx.fillStyle = gradeInfo.grade === 'A' ? '#10b981' : gradeInfo.grade === 'B' ? '#6366f1' : '#f59e0b';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 120px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gradeInfo.grade, 1000, 315);

    // Summary Text
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6366f1';
    ctx.font = 'bold 40px Inter, sans-serif';
    ctx.fillText('MeroSadak Highway Safety Report', 80, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 80px Inter, sans-serif';
    ctx.fillText(`${highway.code} - ${highway.name || 'Strategic Route'}`, 80, 200);

    ctx.font = 'bold 30px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Region: ${highway.districts?.slice(0, 4).join(', ') || 'National Network'}`, 80, 260);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px Inter, sans-serif';
    ctx.fillText(`Length: ${highway.lengthKm || '---'} KM`, 80, 450);
    ctx.fillText(`Infrastructure Quality: ${highway.qualityScore || 0}%`, 80, 520);

    const link = document.createElement('a');
    link.download = `MeroSadak_${highway.code}_Safety_Card.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const currentSimDistrict = useMemo(() => {
    if (!selectedHighwayForDetails?.districts) return "...";
    const idx = Math.floor((videoProgress / 100) * selectedHighwayForDetails.districts.length);
    return selectedHighwayForDetails.districts[idx] || selectedHighwayForDetails.districts[0];
  }, [videoProgress, selectedHighwayForDetails]);

  const isHighRiskDistrict = useMemo(() => {
    const riskDistricts = ["Dhading", "Makwanpur", "Sindhupalchok", "Kavrepalanchok", "Gorkha", "Mugling", "Kalikot", "Jumla", "Myagdi"];
    return riskDistricts.includes(currentSimDistrict);
  }, [currentSimDistrict]);

  // 🔊 Sector Alert: Triggers audio warning for high-risk zones during simulation
  useEffect(() => {
    if (isVideoPlaying && isHighRiskDistrict && currentSimDistrict !== lastAlertDistrictRef.current) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Clear queue for immediate warning
        const utterance = new SpeechSynthesisUtterance(`Warning: Entering high risk sector, ${currentSimDistrict}. Exercise caution.`);
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }
      lastAlertDistrictRef.current = currentSimDistrict;
    } else if (!isHighRiskDistrict) {
      lastAlertDistrictRef.current = null;
    }
  }, [currentSimDistrict, isHighRiskDistrict, isVideoPlaying]);

  const resourceStats = useMemo(() => {
    if (!selectedHighwayForDetails?.districts) return [];
    return selectedHighwayForDetails.districts.map((dist: string) => ({
      name: dist,
      fuel: Math.floor(Math.random() * 8) + 1,
      food: Math.floor(Math.random() * 12) + 3,
      medical: Math.floor(Math.random() * 4) + 1
    }));
  }, [selectedHighwayForDetails]);

  const missionObjectives = useMemo(() => {
    if (!selectedHighwayForDetails || !resourceStats.length) return [];
    const objectives = [
      { title: 'Strategic Refuel', description: 'Recommended stop based on low POI density ahead.', icon: Fuel },
      { title: 'Terrain Inspection', description: 'Mandatory brake check before entering high-grade descent.', icon: Activity }
    ];

    // ⛽ Refuel Warning logic: Distance between fuel-dense districts > 100km
    const totalKm = selectedHighwayForDetails.lengthKm || 0;
    const distPerSector = totalKm / resourceStats.length;
    let lastFuelDenseIdx = -1;
    let maxFuelGapKm = 0;

    resourceStats.forEach((stat, idx) => {
      if (stat.fuel > 5) {
        if (lastFuelDenseIdx !== -1) {
          const gap = (idx - lastFuelDenseIdx) * distPerSector;
          if (gap > maxFuelGapKm) maxFuelGapKm = gap;
        }
        lastFuelDenseIdx = idx;
      }
    });

    if (maxFuelGapKm > 100) {
      objectives.push({
        title: 'Refuel Warning',
        description: `Critical gap in fuel density detected (${maxFuelGapKm.toFixed(0)}km). Refuel at earliest opportunity.`,
        icon: AlertTriangle
      });
    }

    if (selectedHighwayForDetails.code === 'NH01') {
      objectives.push({ title: 'Manakamana Access', description: 'Major tourist junction at Kurintar.', icon: Globe });
    }
    return objectives;
  }, [selectedHighwayForDetails, resourceStats]);

  // ⚔️ Export Side-by-Side Infrastructure Duel Card
  const handleExportComparison = () => {
    if (compareList.length !== 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Background
    const gradient = ctx.createLinearGradient(0, 0, 1200, 800);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 800);

    // 2. Title
    ctx.fillStyle = '#6366f1';
    ctx.font = '900 50px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MeroSadak Infrastructure Duel', 600, 80);

    // 3. Central Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(600, 150); ctx.lineTo(600, 750); ctx.stroke();

    // 🛡️ Mission Patch Watermark (Duel Style)
    ctx.save();
    ctx.translate(600, 400);
    ctx.fillStyle = '#0f172a'; // Tactical slate
    ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6366f1'; // Indigo border
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', 0, 0);
    ctx.restore();

    compareList.forEach((h, i) => {
      const centerX = i === 0 ? 300 : 900;
      const rank = getNationalRank(h.code);
      const gradeInfo = getSafetyGrade(h.qualityScore);

      // Code Box
      ctx.fillStyle = '#6366f1';
      ctx.font = '900 80px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(h.code, centerX, 250);

      // Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px Inter, sans-serif';
      ctx.fillText(h.name || 'Strategic Road', centerX, 320);

      // Safety Score
      ctx.fillStyle = gradeInfo.grade === 'A' ? '#10b981' : '#6366f1';
      ctx.font = '900 120px Inter, sans-serif';
      ctx.fillText(`${h.qualityScore || 0}%`, centerX, 480);
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillText(`GRADE ${gradeInfo.grade}`, centerX, 520);

      // Rank
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'black 28px Inter, sans-serif';
      ctx.fillText(`NATIONAL RANK: #${rank}`, centerX, 600);

      // Length
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 40px Inter, sans-serif';
      ctx.fillText(`${h.lengthKm || '---'} KM`, centerX, 700);
    });

    const link = document.createElement('a');
    link.download = `MeroSadak_Duel_${compareList[0].code}_vs_${compareList[1].code}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // 🗺️ Generate Regional Leaderboard Canvas Image
  const handleShareRegionalLeaderboard = () => {
    if (!selectedProvinceForLeaderboard) return;

    const topHighways = nationalLeaderboard
      .filter(h => h.provinces?.includes(selectedProvinceForLeaderboard))
      .slice(0, 3);

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 1200, 900);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 900);

    // Header
    ctx.fillStyle = '#6366f1';
    ctx.font = '900 60px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Regional Safety Standings', 600, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Inter, sans-serif';
    ctx.fillText(`Province: ${selectedProvinceForLeaderboard}`, 600, 150);

    // Draw Top 3 Cards
    topHighways.forEach((h, i) => {
      const y = 220 + (i * 220);
      const gradeInfo = getSafetyGrade(h.qualityScore);

      // Card Background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(100, y, 1000, 180, 40);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.stroke();

      // Rank & Code
      ctx.textAlign = 'left';
      ctx.fillStyle = '#6366f1';
      ctx.font = '900 40px Inter, sans-serif';
      ctx.fillText(`#${i + 1}`, 150, y + 105);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 60px Inter, sans-serif';
      ctx.fillText(h.code, 250, y + 105);

      // Name
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(h.name || 'Strategic Road', 450, y + 100);

      // Score
      ctx.textAlign = 'right';
      ctx.fillStyle = gradeInfo.grade === 'A' ? '#10b981' : '#6366f1';
      ctx.font = '900 70px Inter, sans-serif';
      ctx.fillText(`${h.qualityScore}%`, 1050, y + 110);
    });

    const link = document.createElement('a');
    link.download = `MeroSadak_Safety_Ranking_${selectedProvinceForLeaderboard.replace(/\s/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Close on Escape key
  useEscapeKey(onClose);
  useEscapeKey(() => setShowComparison(false), showComparison);
  useEscapeKey(() => setShowRegionalLeaderboard(false), showRegionalLeaderboard);




  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${isOpen ? 'animate-in fade-in' : 'animate-out fade-out'} duration-300`}>
      <div className={`w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden transition-all ${isOpen ? 'animate-in zoom-in-95' : 'animate-out zoom-out-95'} duration-200`}>

        {/* Header & Search */}
        <div className="p-6 border-b border-outline/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500">
                <Globe size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-on-surface font-headline leading-tight">National Highways</h2>
                <p className="text-xs text-on-surface-variant/60 font-medium">Explore 79+ strategic road networks of Nepal</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input
                type="text"
                autoFocus
                placeholder="Search NH#, name, district, or province..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-12 py-4 rounded-2xl bg-surface-container-low border border-outline/10 text-sm font-bold focus:outline-none focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-container-high transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setFilterHighSafety(!filterHighSafety)}
              className={`px-4 rounded-2xl border transition-all flex items-center justify-center gap-2 ${filterHighSafety
                ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                : 'bg-surface-container-low border-outline/10 text-on-surface-variant/60 hover:border-emerald-500/30'
                }`}
              title={filterHighSafety ? "Showing high safety" : "Filter by high safety (Grade B+)"}
            >
              <Shield size={18} />
            </button>
            <button
              onClick={() => setSortByLength(!sortByLength)}
              className={`px-4 rounded-2xl border transition-all flex items-center justify-center gap-2 ${sortByLength
                ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                : 'bg-surface-container-low border-outline/10 text-on-surface-variant/60 hover:border-indigo-500/30'
                }`}
              title={sortByLength ? "Sorted by length" : "Sort by length"}
            >
              <ArrowDownWideNarrow size={18} />
            </button>
            <button
              onClick={() => setShowRegionalLeaderboard(true)}
              className="px-4 rounded-2xl border bg-surface-container-low border-outline/10 text-on-surface-variant/60 hover:border-indigo-500/30 transition-all flex items-center justify-center gap-2"
              title="Regional Leaderboard"
            >
              <Trophy size={18} />
            </button>
          </div>
        </div>

        {/* Highway List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-24">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
              <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Loading Infrastructure...</span>
            </div>
          ) : processedHighways.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-indigo-500/20 flex justify-center mb-4"><Hash size={48} /></div>
              <p className="text-sm font-bold text-on-surface-variant">No highways match "{searchQuery}"</p>
              <button onClick={() => setSearchQuery('')} className="mt-2 text-xs font-black text-indigo-500 uppercase tracking-widest">Show All Highways</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {processedHighways.map((highway) => (
                <button
                  key={highway.code}
                  onClick={() => onSelect(highway.code)}
                  className={`flex items-center gap-4 p-4 rounded-3xl bg-surface-container-lowest border transition-all group text-left ${compareList.find(h => h.code === highway.code) ? 'border-indigo-500 bg-indigo-50/50' : 'border-outline/5 hover:border-indigo-500/30 hover:bg-indigo-500/5'}`}
                >
                  <button
                    onClick={(e) => handleToggleCompare(highway, e)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${compareList.find(h => h.code === highway.code) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-outline/20 text-transparent'}`}
                  >
                    <CheckCircle2 size={12} />
                  </button>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black text-xs shadow-sm group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      {highway.code}
                    </div>
                    <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${getSafetyGrade(highway.qualityScore).color} text-white text-[7px] font-black relative group/tooltip`}>
                      <Shield size={6} fill="currentColor" />
                      {getSafetyGrade(highway.qualityScore).grade}
                      {/* Safety Grade Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-slate-900 text-white text-[6px] rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-white/10 text-center uppercase tracking-tighter">
                        Factors: Pavement (40%), Condition (40%), Lane Width (20%)
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-on-surface truncate group-hover:text-indigo-600 transition-colors">
                      {highway.name || 'Unnamed Strategic Road'}
                    </h4>
                    {highway.districts && Array.isArray(highway.districts) && highway.districts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {highway.districts.map((dist: string, i: number) => (
                          <span key={i} className="text-[7px] font-bold text-on-surface-variant/30 uppercase tracking-tighter bg-surface-container-low px-1 rounded">
                            {dist}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-tighter truncate max-w-[200px]">{highway.route || 'Network connection'}</span>
                      {highway.lengthKm && (
                        <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-black ml-auto bg-indigo-500/5 px-2 py-0.5 rounded-full">
                          <Ruler size={10} />
                          {highway.lengthKm} KM
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareHighway(highway);
                    }}
                    className="p-2 rounded-xl hover:bg-surface-container-high text-on-surface-variant/40 hover:text-indigo-500 transition-all ml-2"
                    title="Share Safety Card"
                  >
                    <Share2 size={18} />
                  </button>
                  <div className="p-2 rounded-full bg-surface-container-high opacity-0 group-hover:opacity-100 transition-all">
                    <ArrowRight size={14} className="text-indigo-500" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 📊 Comparison Control Bar */}
        {compareList.length > 0 && (
          <div className="absolute bottom-6 left-6 right-6 p-4 bg-indigo-600 rounded-[2rem] shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-4 z-[2600]">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                {compareList.map(h => (
                  <div key={h.code} className="w-10 h-10 rounded-xl bg-white text-indigo-600 flex items-center justify-center font-black text-xs border-2 border-indigo-600 shadow-lg">
                    {h.code}
                  </div>
                ))}
              </div>
              <p className="text-white text-xs font-black uppercase tracking-widest">
                {compareList.length === 2 ? "Ready to compare" : "Select one more"}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCompareList([])} className="p-2 text-white/60 hover:text-white transition-colors">
                <X size={20} />
              </button>
              {compareList.length === 2 && (
                <button
                  onClick={() => setShowComparison(true)}
                  className="px-6 py-2 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                >
                  Compare Now
                </button>
              )}
            </div>
          </div>
        )}

        {/* 🏔️ Side-by-Side Comparison Modal */}
        {showComparison && (
          <div className="fixed inset-0 z-[2700] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-white/10 overflow-hidden">
              <div className="p-8 border-b border-outline/10 flex items-center justify-between">
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                  <Scale className="text-indigo-500" /> Infrastructure Duel
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportComparison}
                    className="p-2 hover:bg-indigo-500 hover:text-white rounded-full transition-all text-indigo-500"
                    title="Export Battle Card"
                  >
                    <Download size={24} />
                  </button>
                  <button onClick={() => setShowComparison(false)} className="p-2 hover:bg-surface-container-low rounded-full transition-colors"><X size={24} /></button>
                </div>
              </div>
              <div className="p-8 grid grid-cols-2 gap-8 relative">
                <div className="absolute left-1/2 top-8 bottom-8 w-px bg-outline/10" />
                {compareList.map((h, i) => (
                  <div key={h.code} className="space-y-6">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto rounded-[1.5rem] bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black text-lg shadow-inner mb-3">
                        {h.code}
                      </div>
                      <h4 className="text-sm font-black uppercase tracking-widest line-clamp-1">{h.name || 'Strategic Road'}</h4>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Trophy size={8} /> National Standings
                        </p>
                        <div className="text-lg font-black text-on-surface">Rank #{getNationalRank(h.code)} <span className="text-[10px] text-on-surface-variant/40">of {highways.length}</span></div>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Safety Vector</p>
                        <div className={`text-2xl font-black font-headline ${getSafetyGrade(h.qualityScore).text}`}>{h.qualityScore || 0}%</div>
                        <span className={`text-[10px] font-bold uppercase ${getSafetyGrade(h.qualityScore).text}`}>Grade {getSafetyGrade(h.qualityScore).grade}</span>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Operational Length</p>
                        <div className="text-lg font-black text-on-surface tabular-nums">{h.lengthKm || '---'} KM</div>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Regional Reach</p>
                        <p className="text-[10px] font-bold text-on-surface-variant/70 leading-tight">{h.districts?.slice(0, 3).join(', ')}...</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setShowComparison(false); onSelect(h.code); }}
                      className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                    >
                      Select {h.code}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 🏆 Regional Leaderboard Modal */}
        {showRegionalLeaderboard && (
          <div className="fixed inset-0 z-[2700] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-white/10 overflow-hidden">
              <div className="p-8 border-b border-outline/10 flex items-center justify-between">
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                  <Trophy className="text-amber-500" /> Regional Leaderboard
                </h3>
                <div className="flex items-center gap-2">
                  {selectedProvinceForLeaderboard && (
                    <button
                      onClick={handleShareRegionalLeaderboard}
                      className="p-2 hover:bg-indigo-500 hover:text-white rounded-full transition-all text-indigo-500"
                      title="Share Rankings"
                    >
                      <Share2 size={24} />
                    </button>
                  )}
                  <button onClick={() => setShowRegionalLeaderboard(false)} className="p-2 hover:bg-surface-container-low rounded-full transition-colors"><X size={24} /></button>
                </div>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-black uppercase text-on-surface-variant/40 tracking-widest">Select Province</label>
                  <select
                    value={selectedProvinceForLeaderboard || ''}
                    onChange={(e) => setSelectedProvinceForLeaderboard(e.target.value)}
                    className="w-full p-3 rounded-xl bg-surface-container-low border border-outline/10 text-sm font-bold focus:outline-none focus:border-indigo-500/30"
                  >
                    <option value="">All Provinces</option>
                    {uniqueProvinces.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {selectedProvinceForLeaderboard && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-black text-on-surface">{selectedProvinceForLeaderboard} - Top Highways</h4>
                    {nationalLeaderboard
                      .filter(h => h.provinces?.includes(selectedProvinceForLeaderboard))
                      .slice(0, 3)
                      .map((h, index) => (
                        <div key={h.code} className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-lowest border border-outline/5">
                          <span className="text-xl font-black text-indigo-500">{index + 1}.</span>
                          <div className="flex-1">
                            <h5 className="text-sm font-black text-on-surface">{h.code} - {h.name || 'Strategic Road'}</h5>
                            <p className={`text-xs font-bold ${getSafetyGrade(h.qualityScore).text}`}>Safety Grade: {getSafetyGrade(h.qualityScore).grade} ({h.qualityScore}%)</p>
                          </div>
                          <button
                            onClick={() => setSelectedHighwayForDetails(h)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    {nationalLeaderboard.filter(h => h.provinces?.includes(selectedProvinceForLeaderboard)).length === 0 && (
                      <p className="text-sm text-on-surface-variant/60 italic">No highways found for this province.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 📋 Highway Intelligence Detail Modal */}
        {selectedHighwayForDetails && (
          <div className="fixed inset-0 z-[2800] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in">
            <div className={`w-full max-w-md rounded-[3rem] shadow-2xl border transition-colors duration-500 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar ${isNightSimulation ? 'bg-black border-red-900/50' : 'bg-white dark:bg-slate-900 border-white/10'}`}>
              <div className="p-8 border-b border-outline/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-sm">
                    {selectedHighwayForDetails.code}
                  </div>
                  <div>
                    <h3 className={`text-lg font-black uppercase tracking-tight leading-none transition-colors ${isNightSimulation ? 'text-red-500' : ''}`}>Highway Intelligence</h3>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isNightSimulation ? 'text-red-900' : 'text-on-surface-variant/40'}`}>Infrastructure Report</p>
                  </div>
                </div>
                <button onClick={() => setSelectedHighwayForDetails(null)} className="p-2 hover:bg-surface-container-low rounded-full transition-colors"><X size={24} /></button>
              </div>

              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Safety Grade</p>
                    <div className={`text-4xl font-black font-headline ${isNightSimulation ? 'text-red-600' : getSafetyGrade(selectedHighwayForDetails.qualityScore).text}`}>
                      {getSafetyGrade(selectedHighwayForDetails.qualityScore).grade}
                    </div>
                    <span className={`text-[10px] font-bold uppercase ${isNightSimulation ? 'text-red-900' : 'text-on-surface-variant/60'}`}>{selectedHighwayForDetails.qualityScore}% Quality Score</span>
                  </div>
                  <div className="text-right">
                    <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isNightSimulation ? 'text-red-800' : 'text-amber-500'}`}>National Rank</p>
                    <div className={`text-2xl font-black tabular-nums ${isNightSimulation ? 'text-red-500' : 'text-on-surface'}`}>#{getNationalRank(selectedHighwayForDetails.code)}</div>
                    <span className={`text-[10px] font-bold uppercase ${isNightSimulation ? 'text-red-900' : 'text-on-surface-variant/60'}`}>of {highways.length} Highways</span>
                  </div>
                </div>

                {/* 📈 Safety Evolution Sparkline */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <History size={10} className={isNightSimulation ? 'text-red-900' : 'text-on-surface-variant/40'} />
                    <p className={`text-[8px] font-black uppercase tracking-widest ${isNightSimulation ? 'text-red-800' : 'text-on-surface-variant/40'}`}>Infrastructure Evolution</p>
                  </div>
                  <div className={`h-16 w-full p-2 rounded-2xl border relative overflow-hidden ${isNightSimulation ? 'bg-red-950/10 border-red-900/30' : 'bg-surface-container-low border-outline/5'}`}>
                    <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
                      <path
                        d={`M 0,${40 - (mockTimeline[0]?.score / 100 * 30 + 5)} ${mockTimeline.map((p, i) => `L ${(i / (mockTimeline.length - 1)) * 100},${40 - (p.score / 100 * 30 + 5)}`).join(' ')}`}
                        fill="none"
                        stroke={isNightSimulation ? '#dc2626' : '#6366f1'}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className={`absolute bottom-1 left-2 right-2 flex justify-between text-[6px] font-bold uppercase ${isNightSimulation ? 'text-red-900' : 'text-on-surface-variant/30'}`}>
                      <span>6 Months Ago</span>
                      <span>Present Day</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-2xl border ${isNightSimulation ? 'bg-red-950/10 border-red-900/30' : 'bg-surface-container-low border-outline/5'}`}>
                    <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Operational Length</p>
                    <div className={`text-lg font-black tabular-nums ${isNightSimulation ? 'text-red-500' : 'text-on-surface'}`}>{selectedHighwayForDetails.lengthKm || '---'} KM</div>
                  </div>
                  <div className={`p-4 rounded-2xl border ${isNightSimulation ? 'bg-red-950/10 border-red-900/30' : 'bg-surface-container-low border-outline/5'}`}>
                    <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">Design Speed</p>
                    <div className={`text-lg font-black tabular-nums ${isNightSimulation ? 'text-red-500' : 'text-on-surface'}`}>80 <span className="text-[10px]">KM/H</span></div>
                  </div>
                </div>

                {/* 🎥 Virtual Mission Simulation */}
                <div className={`p-5 rounded-[2rem] border space-y-4 ${isNightSimulation ? 'bg-red-950/10 border-red-900/30' : 'bg-indigo-600/5 border-indigo-600/10'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full animate-pulse ${isHighRiskDistrict ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : isNightSimulation ? 'bg-red-700' : 'bg-indigo-500'}`} />
                      <span className={`text-[8px] font-black uppercase tracking-widest ${isHighRiskDistrict ? 'text-red-500' : isNightSimulation ? 'text-red-800' : 'text-indigo-500'}`}>Virtual Drive Simulation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowWeatherLayer(!showWeatherLayer)}
                        className={`px-2 py-0.5 rounded-full text-[6px] font-black uppercase tracking-tighter border transition-all ${showWeatherLayer ? 'bg-blue-500 border-blue-500 text-white' : 'bg-transparent border-on-surface-variant/20 text-on-surface-variant/40'}`}
                      >
                        Weather Layer
                      </button>
                      <span className={`text-[7px] font-black uppercase ${isHighRiskDistrict ? 'text-red-600 animate-pulse' : isNightSimulation ? 'text-red-900' : 'text-on-surface-variant/40'}`}>Sector: {currentSimDistrict}</span>
                    </div>
                  </div>
                  <div className={`relative h-1.5 w-full rounded-full overflow-hidden bg-black/5`}>
                    {/* Landslide Risk Heat Map Layer */}
                    <div className="absolute inset-0" style={{ background: riskHeatMapGradient }} />
                    {/* Precipitation Weather Layer (Overlay) */}
                    {showWeatherLayer && (
                      <div className="absolute inset-0 animate-in fade-in" style={{ background: weatherHeatMapGradient }} />
                    )}
                    <div style={{ width: `${videoProgress}%` }} className={`absolute inset-y-0 left-0 transition-all duration-100 ${isHighRiskDistrict ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : isNightSimulation ? 'bg-red-600' : 'bg-indigo-500'}`} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                      className={`flex-[2] py-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${isNightSimulation ? 'bg-red-900 text-white shadow-red-950/20' : 'bg-indigo-600 text-white shadow-indigo-600/20'}`}
                    >
                      {isVideoPlaying ? <Pause size={12} /> : <Play size={12} />}
                      {isVideoPlaying ? 'Abort Simulation' : 'Start virtual mission'}
                    </button>
                    <button
                      onClick={() => setIsNightSimulation(!isNightSimulation)}
                      className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-all ${isNightSimulation ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'bg-transparent border-indigo-500/30 text-indigo-500 hover:bg-indigo-500 hover:text-white'}`}
                    >
                      {isNightSimulation ? 'Daylight' : 'Night Mode'}
                    </button>
                  </div>
                </div>

                {/* 🎯 Mission Objectives Card */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Target size={10} className={isNightSimulation ? 'text-red-900' : 'text-primary'} />
                    <p className={`text-[8px] font-black uppercase tracking-widest ${isNightSimulation ? 'text-red-800' : 'text-on-surface-variant/40'}`}>Mission Objectives</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {missionObjectives.map((obj, i) => (
                      <div key={i} className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors ${isNightSimulation ? 'bg-red-950/10 border-red-900/30 hover:border-red-500/40' : 'bg-surface-container-low border-outline/5 hover:border-primary/20'}`}>
                        <div className={`p-2 rounded-xl ${isNightSimulation ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
                          <obj.icon size={16} />
                        </div>
                        <div>
                          <h5 className={`text-[10px] font-black uppercase tracking-tight ${isNightSimulation ? 'text-red-600' : 'text-on-surface'}`}>{obj.title}</h5>
                          <p className={`text-[9px] font-medium leading-tight mt-0.5 ${isNightSimulation ? 'text-red-900' : 'text-on-surface-variant/70'}`}>
                            {obj.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest px-1">Regional Reach</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedHighwayForDetails.districts?.map((dist: string, i: number) => (
                      <span key={i} className="px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline/5 text-[10px] font-bold text-on-surface">
                        {dist}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleExportTacticalBriefing}
                  className={`w-full py-4 rounded-[2rem] border transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${isNightSimulation ? 'bg-red-950/20 border-red-900/30 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-indigo-500/5 border-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white'}`}
                >
                  <FileText size={14} />
                  Export Tactical PDF Briefing
                </button>

                <button
                  onClick={() => {
                    onSelect(selectedHighwayForDetails.code);
                    setSelectedHighwayForDetails(null);
                    setShowRegionalLeaderboard(false);
                  }}
                  className="w-full py-4 bg-indigo-600 text-white rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  Focus Mission on {selectedHighwayForDetails.code}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};