import { logError } from "../logs/logs.js";

/**
 * Service to handle public safety record verification logic.
 */
export const verificationService = {
    /**
     * Generates the HTML for the public verification landing page.
     */
    generateVerificationPage: (data: any, type: 'user' | 'trip') => {
        const title = type === 'user' ? 'Safety Profile Verified' : 'Trip Record Verified';
        const subTitle = type === 'user' ? 'National Strategic Road Sentinel' : 'Official Journey Summary';
        const brandColor = '#6366f1'; // Indigo
        const successColor = '#10b981'; // Emerald

        const score = data.safetyScore || data.score || 100;
        const rating = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : 'Caution';
        const statusColor = score >= 80 ? successColor : score >= 50 ? '#f59e0b' : '#ef4444';

        const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
        const gradeColor = score >= 90 ? successColor : score >= 80 ? brandColor : score >= 70 ? '#f59e0b' : score >= 60 ? '#f97316' : '#ef4444';

        return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MeroSadak | ${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #020617; color: white; }
          .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
          .glow { box-shadow: 0 0 30px ${brandColor}33; }
        </style>
      </head>
      <body class="min-h-screen flex items-center justify-center p-4">
        <div class="w-full max-w-md animate-in fade-in zoom-in duration-700">
          <!-- Branding -->
          <div class="text-center mb-8">
            <h1 class="text-2xl font-black italic tracking-tighter text-indigo-500 uppercase">MeroSadak</h1>
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Digital Safety Registry</p>
          </div>

          <!-- Certificate Card (Wrapped for Image Export) -->
          <div id="certificate-card" class="glass rounded-[2.5rem] p-8 glow relative overflow-hidden mb-6">
            <div class="absolute top-0 right-0 p-6 opacity-10">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>

            <!-- 🏅 Grade Badge Overlay -->
            <div class="absolute top-8 right-8 w-16 h-16 rounded-[1.2rem] flex flex-col items-center justify-center border-2 rotate-12 shadow-2xl backdrop-blur-md transition-transform hover:rotate-0 duration-500" 
                 style="border-color: ${gradeColor}; background: ${gradeColor}15;">
                <span class="text-[8px] font-black uppercase tracking-widest mb-0.5" style="color: ${gradeColor}">Grade</span>
                <span class="text-3xl font-black leading-none" style="color: ${gradeColor}">${grade}</span>
            </div>

            <div class="flex flex-col items-center text-center">
              <div class="w-24 h-24 rounded-full border-4 border-dashed border-indigo-500/30 flex items-center justify-center mb-6">
                <div class="w-20 h-20 rounded-full flex flex-col items-center justify-center bg-indigo-500 text-white shadow-xl shadow-indigo-500/20">
                  <span class="text-2xl font-black leading-none">${score}</span>
                  <span class="text-[8px] font-black uppercase tracking-tighter">PTS</span>
                </div>
              </div>

              <h2 class="text-xl font-extrabold mb-1">${title}</h2>
              <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">${subTitle}</p>

              <!-- Safety Trend Chart -->
              <div class="w-full mb-8 bg-white/5 rounded-2xl p-4 border border-white/5">
                <canvas id="safetyChart" height="120"></canvas>
              </div>

              <div class="w-full grid grid-cols-2 gap-4 mb-8">
                <div class="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p class="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</p>
                  <p class="text-sm font-black" style="color: ${statusColor}">${rating.toUpperCase()}</p>
                </div>
                <div class="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p class="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Traveled</p>
                  <p class="text-sm font-black text-indigo-400">${data.totalKm || data.distance || '0'} KM</p>
                </div>
              </div>

              <div class="w-full space-y-3 text-left">
                <div class="flex justify-between items-center py-3 border-b border-white/5">
                  <span class="text-[10px] font-bold text-slate-400 uppercase">Registry Name</span>
                  <span class="text-xs font-bold">${data.name || 'Anonymous Traveler'}</span>
                </div>
                <div class="flex justify-between items-center py-3 border-b border-white/5">
                  <span class="text-[10px] font-bold text-slate-400 uppercase">Longest Streak</span>
                  <span class="text-xs font-bold text-amber-500">${data.streak || data.longestStreak || '0'} Mins</span>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <!-- 📸 Export Action -->
            <button id="download-image" class="w-full py-4 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              Download as Image
            </button>

            <!-- 💬 WhatsApp Share -->
            <button id="share-whatsapp" class="w-full py-4 rounded-2xl bg-[#25D366] text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.353-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.216 1.36.186 1.871.11.57-.085 1.758-.467 2.006-1.185.248-.718.248-1.334.173-1.463-.075-.128-.275-.197-.57-.346zm-5.448 4.632l-.02.001c-1.03 0-2.047-.278-2.942-.804l-.21-.124-2.185.573.583-2.129-.136-.216c-.579-.922-.885-1.986-.885-3.077 0-4.385 3.57-7.955 7.956-7.955 2.125 0 4.12.827 5.621 2.329 1.502 1.503 2.328 3.499 2.328 5.625 0 4.387-3.57 7.957-7.957 7.957zM20.12 4.272C18.017 2.169 15.211 1 12.242 1 5.482 1 0 6.482 0 13.242c0 2.16.564 4.269 1.633 6.136L0 25l6.305-1.654c1.791.976 3.805 1.492 5.865 1.493h.005c6.76 0 12.242-5.482 12.242-12.242 0-3.131-1.218-6.075-3.43-8.289z"/></svg>
              WhatsApp Share
            </button>
          </div>

          <p class="mt-8 text-center text-[9px] text-slate-500 leading-relaxed px-6">
            This record is digitally signed by the MeroSadak AI Pilot System. 
            Authenticity can be verified via the Nepal Strategic Road Network database.
          </p>
        </div>

        <script>
          // Chart initialization
          const ctx = document.getElementById('safetyChart').getContext('2d');
          const chartData = ${JSON.stringify(data.scoreHistory || [{ score: 100, time: 'Start' }, { score: 100, time: 'End' }])};
          
          new Chart(ctx, {
            type: 'line',
            data: {
              labels: chartData.map(d => d.time),
              datasets: [{
                data: chartData.map(d => d.score),
                borderColor: '${brandColor}',
                borderWidth: 3,
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
              }]
            },
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { x: { display: false }, y: { min: 0, max: 100, ticks: { display: false }, grid: { display: false } } }
            }
          });

          // Image Download Logic using html2canvas
          document.getElementById('download-image').onclick = function() {
            const btn = this;
            btn.disabled = true;
            const originalText = btn.innerHTML;
            btn.innerText = 'Processing...';
            
            const card = document.getElementById('certificate-card');
            html2canvas(card, {
              backgroundColor: '#020617',
              scale: 3, // High resolution scale
              useCORS: true,
              logging: false
            }).then(canvas => {
              const link = document.createElement('a');
              link.download = 'MeroSadak_Safety_Registry.png';
              link.href = canvas.toDataURL('image/png');
              link.click();
              btn.disabled = false;
              btn.innerHTML = originalText;
            }).catch(err => {
              console.error(err);
              btn.disabled = false;
              btn.innerHTML = 'Error saving image';
            });
          };

          // WhatsApp Share Logic
          document.getElementById('share-whatsapp').onclick = function() {
            const text = encodeURIComponent('🏆 *MeroSadak Verified Safety Record*\\n\\nStatus: *${rating}*\\nScore: *${score} PTS*\\nGrade: *${grade}*\\n\\nVerify here: ' + window.location.href + '\\n\\n#MeroSadak #SafeTravelsNepal');
            window.open('https://wa.me/?text=' + text, '_blank');
          };
        </script>
      </body>
      </html>
    `;
    }
};