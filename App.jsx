import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, serverTimestamp, doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from 'firebase/storage';
import { 
  MapPin, User, ShoppingBag, QrCode, ChevronLeft, 
  Plus, X, Power, Shield, Map as MapIcon, Grid,
  ChevronRight, Loader2, Trash2, Navigation, 
  MessageSquare, Send, Bell, Search, Share2, 
  Instagram, Truck, Store, Zap, CheckCircle2, Ticket, Tag,
  Car, AlertCircle
} from 'lucide-react';

// --- PRODUCTION SECURE CONFIGURATION ---
// Enhanced configuration to support both Vercel/Vite production and the Preview environment
const getFirebaseConfig = () => {
  // 1. Check if the environment provides a global config string (Preview Environment)
  if (typeof __firebase_config !== 'undefined') {
    try {
      return JSON.parse(__firebase_config);
    } catch (e) {
      console.error("Failed to parse __firebase_config");
    }
  }

  // 2. Fallback to Vite Environment Variables (Production/Local Dev)
  // We use a safe check to avoid "import.meta" compilation errors in older targets
  try {
    const metaEnv = import.meta.env;
    return {
      apiKey: metaEnv.VITE_FIREBASE_API_KEY,
      authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: metaEnv.VITE_FIREBASE_PROJECT_ID,
      storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: metaEnv.VITE_FIREBASE_APP_ID
    };
  } catch (e) {
    return {};
  }
};

const firebaseConfig = getFirebaseConfig();

// Error boundary for Firebase Init
let app, auth, db, storage;
if (firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (e) {
    console.error("Firebase failed to load.", e);
  }
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'poppop-go-production';

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore'); 
  const [displayMode, setDisplayMode] = useState('list'); 
  const [drops, setDrops] = useState([]);
  const [memos, setMemos] = useState([]);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [memoText, setMemoText] = useState("");
  const [loyaltyUnlocked, setLoyaltyUnlocked] = useState(false);
  const [menuItemInput, setMenuItemInput] = useState({ name: '', price: '' });

  const [newDrop, setNewDrop] = useState({
    title: '', locationName: '', zelleId: '', images: [], status: 'live', type: 'food-truck', hasCoupon: true, menu: [] 
  });

  // 1. Auth Init
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth fail", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Data Subscriptions
  useEffect(() => {
    if (!user || !db) return;
    const dropsQ = query(collection(db, 'artifacts', appId, 'public', 'data', 'drops'));
    const unsubDrops = onSnapshot(dropsQ, (snap) => {
      setDrops(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
    });
    const memosQ = query(collection(db, 'artifacts', appId, 'public', 'data', 'memos'));
    const unsubMemos = onSnapshot(memosQ, (snap) => {
      setMemos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.merchantId === user.uid));
    });
    return () => { unsubDrops(); unsubMemos(); };
  }, [user]);

  // Actions
  const handleUberRide = (drop) => {
    const url = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${drop.lat}&dropoff[longitude]=${drop.lng}&dropoff[nickname]=${encodeURIComponent(drop.title)}`;
    window.open(url, '_blank');
  };

  const shareToSocial = async (drop, platform) => {
    const text = `🔥 10% OFF DEAL: Visit ${drop.title} at ${drop.locationName}! Menu live on PopPop Go. https://poppopnow.com`;
    try {
      await navigator.clipboard.writeText(text);
      if (platform === 'instagram') window.location.href = 'instagram://camera';
      if (drop.hasCoupon) setLoyaltyUnlocked(true);
      alert("Text copied! Paste it in your story.");
    } catch (err) {
      console.error("Sharing failed", err);
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!storage) return;
    setIsUploading(true);
    const urls = [];
    for (let file of files) {
      const sRef = ref(storage, `artifacts/${appId}/drops/${Date.now()}_${file.name}`);
      try {
        const snap = await uploadBytes(sRef, file);
        urls.push(await getDownloadURL(snap.ref));
      } catch (err) { console.error("Upload fail", err); }
    }
    setNewDrop(prev => ({ ...prev, images: [...prev.images, ...urls].slice(0, 5) }));
    setIsUploading(false);
  };

  const handlePostDrop = async (e) => {
    e.preventDefault();
    if (!db) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'drops'), {
          ...newDrop, merchantId: user.uid, lat: pos.coords.latitude, lng: pos.coords.longitude, createdAt: serverTimestamp(),
        });
        setView('explore');
        setNewDrop({ title: '', locationName: '', zelleId: '', images: [], status: 'live', type: 'food-truck', hasCoupon: true, menu: [] });
      } catch (err) { console.error("Post fail", err); }
    });
  };

  const filteredDrops = drops.filter(d => 
    d.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.locationName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const MapView = () => {
    const mapRef = useRef(null);
    useEffect(() => {
      if (mapRef.current || !window.L) return;
      const map = window.L.map('map-el', { zoomControl: false }).setView([40.7128, -74.0060], 13);
      mapRef.current = map;
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
      filteredDrops.forEach(d => {
        if (!d.lat) return;
        window.L.marker([d.lat, d.lng]).addTo(map).on('click', () => { setSelectedDrop(d); setView('shop-detail'); });
      });
      navigator.geolocation.getCurrentPosition(p => map.setView([p.coords.latitude, p.coords.longitude], 14));
    }, [filteredDrops]);
    return <div id="map-el" className="h-full w-full"></div>;
  };

  if (!firebaseConfig.apiKey) return (
    <div className="h-screen flex items-center justify-center p-10 text-center bg-slate-900 text-white">
      <div className="animate-in fade-in duration-700">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-black italic tracking-tighter">CONFIG ERROR</h2>
        <p className="text-slate-400 text-sm mt-3 leading-relaxed max-w-xs mx-auto font-medium">
          Firebase API Key is missing. Please ensure your Vercel Environment Variables are set up correctly.
        </p>
        <button onClick={() => window.location.reload()} className="mt-8 px-6 py-3 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-white/10">Try Refresh</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans max-w-md mx-auto border-x border-slate-200 relative overflow-hidden text-slate-900">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md px-6 pt-12 pb-4 sticky top-0 z-30 border-b border-slate-100 flex justify-between items-center">
        <div><h1 className="text-2xl font-black text-indigo-600 italic tracking-tighter">PopPop Go</h1></div>
        <div className="flex gap-2">
          <button onClick={() => setDisplayMode(displayMode==='list'?'map':'list')} className="w-10 h-10 rounded-2xl border bg-slate-50 flex items-center justify-center transition-all active:scale-90">{displayMode==='list'?<MapIcon className="w-5 h-5"/>:<Grid className="w-5 h-5"/>}</button>
          <button onClick={() => setView('merchant-dash')} className="w-10 h-10 rounded-2xl border bg-slate-50 flex items-center justify-center relative active:scale-90"><User className="w-5 h-5 text-slate-400"/>{memos.length>0&&<span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative">
        {view === 'explore' && (
          <>
            <div className="p-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-20">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Find Trucks & Pop-ups..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[24px] text-sm font-medium outline-none shadow-sm focus:ring-2 ring-indigo-500/10 transition-all"/>
              </div>
            </div>
            {displayMode === 'list' ? (
              <div className="px-4 space-y-4 pb-32">
                {filteredDrops.map(d => (
                  <div key={d.id} onClick={() => { setSelectedDrop(d); setView('shop-detail'); }} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100 transition-transform active:scale-[0.98]">
                    <img src={d.images?.[0] || 'https://images.unsplash.com/photo-1555529669-2269763671c0'} className="h-64 w-full object-cover" />
                    <div className="p-5 flex justify-between items-center">
                      <div><h3 className="font-bold text-lg tracking-tight">{d.title}</h3><p className="text-xs text-slate-400 font-bold italic">{d.locationName}</p></div>
                      <ChevronRight className="text-slate-200"/>
                    </div>
                  </div>
                ))}
              </div>
            ) : <MapView />}
          </>
        )}

        {view === 'shop-detail' && selectedDrop && (
          <div className="pb-40 bg-white min-h-screen animate-in slide-in-from-right">
            <div className="relative h-80 flex overflow-x-auto snap-x scrollbar-hide">
              {selectedDrop.images?.map((img, i) => <img key={i} src={img} className="w-full h-full object-cover snap-center shrink-0" />)}
              <button onClick={() => setView('explore')} className="absolute top-12 left-6 bg-white/90 p-3 rounded-full shadow-lg z-20"><ChevronLeft /></button>
            </div>
            <div className="p-8 -mt-10 bg-white rounded-t-[48px] relative z-10 space-y-6 shadow-2xl shadow-slate-200/50">
              <div className="flex justify-between items-center"><h2 className="text-3xl font-black italic tracking-tighter">{selectedDrop.title}</h2><div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Live Now</div></div>
              
              <div className="flex gap-3">
                <button onClick={() => window.open(`https://maps.google.com/?q=${selectedDrop.lat},${selectedDrop.lng}`)} className="flex-1 bg-slate-100 p-4 rounded-3xl flex flex-col items-center gap-1 active:bg-slate-200"><Navigation className="w-6 h-6 text-slate-600"/><span className="text-[10px] font-black uppercase text-slate-500">Maps</span></button>
                <button onClick={() => handleUberRide(selectedDrop)} className="flex-1 bg-black p-4 rounded-3xl flex flex-col items-center gap-1 active:scale-95 transition-transform"><Car className="w-6 h-6 text-white"/><span className="text-[10px] font-black uppercase text-white">Uber</span></button>
              </div>

              <button onClick={() => shareToSocial(selectedDrop, 'instagram')} className="w-full bg-gradient-to-r from-pink-500 to-indigo-600 p-5 rounded-[32px] text-white flex justify-between items-center shadow-xl shadow-pink-100 transition-all active:scale-95">
                <div className="flex items-center gap-3"><Instagram className="w-6 h-6"/><div className="text-left font-bold text-sm leading-tight">Share to Story<br/><span className="text-[10px] opacity-80 uppercase tracking-widest font-black">For 10% OFF</span></div></div>
                {loyaltyUnlocked ? <div className="bg-white/20 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-tighter border border-white/30">ANT10</div> : <Plus className="opacity-50"/>}
              </button>

              <div className="bg-slate-900 p-6 rounded-[32px] flex justify-between items-center text-white shadow-xl shadow-slate-900/20 active:bg-black transition-colors" onClick={()=>setShowPayment(true)}>
                <div className="text-left"><p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-1 italic">Pay via Zelle</p><p className="font-bold text-lg tracking-tight">{selectedDrop.zelleId}</p></div>
                <div className="bg-white/10 p-3 rounded-2xl"><QrCode /></div>
              </div>
            </div>
          </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-40">
            <h2 className="text-3xl font-black italic underline decoration-indigo-200 tracking-tighter">Merchant Hub</h2>
            <div className="space-y-4">
              <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest flex items-center gap-2"><Bell className="w-4 h-4 text-red-500"/> Incoming Queue ({memos.length})</h3>
              {memos.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-[32px] text-slate-300 text-xs italic font-medium">No messages yet...</div>
              ) : memos.map(m => (
                <div key={m.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative group animate-in slide-in-from-left">
                  <p className="text-[10px] font-black text-indigo-500 uppercase mb-1 tracking-widest">REQ: {m.dropTitle}</p>
                  <p className="text-sm font-semibold text-slate-700 leading-relaxed">"{m.text}"</p>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'memos', m.id))} className="absolute top-4 right-4 text-slate-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => setView('post')} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black shadow-xl uppercase tracking-widest text-xs active:scale-95 transition-transform">+ DROP NEW SPOT</button>
            </div>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-6 pb-40 animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center"><h2 className="text-3xl font-black italic tracking-tighter">Go Live</h2><button onClick={()=>setView('explore')}><X className="text-slate-300"/></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                 {newDrop.images.map((img, i) => (<div key={i} className="aspect-square rounded-2xl overflow-hidden relative border border-slate-100 shadow-inner"><img src={img} className="w-full h-full object-cover" /></div>))}
                 {newDrop.images.length < 5 && (
                   <label className="aspect-square rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer active:bg-slate-200 transition-colors">
                      {isUploading ? <Loader2 className="animate-spin" /> : <Camera />}
                      <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                   </label>
                 )}
              </div>
              <input required value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title:e.target.value})} placeholder="Truck/Shop Name" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none bg-white focus:ring-2 ring-indigo-500/10 transition-all shadow-sm" />
              <input required value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName:e.target.value})} placeholder="Location Hint (e.g. Near Big Oak)" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none bg-white focus:ring-2 ring-indigo-500/10 transition-all shadow-sm" />
              <input required value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId:e.target.value})} placeholder="Zelle Phone or Email" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none bg-white focus:ring-2 ring-indigo-500/10 transition-all shadow-sm" />
              <button onClick={handlePostDrop} className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black shadow-xl uppercase tracking-widest text-xs active:scale-95 transition-transform">Publish to Map</button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-[32px] py-4 px-10 flex justify-between items-center z-40">
        <button onClick={() => {setView('explore'); setDisplayMode('list');}} className={view==='explore'?'text-indigo-600':'text-slate-300 transition-colors'}><ShoppingBag/></button>
        <button onClick={() => setView('post')} className="bg-indigo-600 text-white p-5 rounded-[24px] shadow-lg shadow-indigo-200 -mt-16 active:scale-90 transition-transform"><Plus className="w-7 h-7"/></button>
        <button onClick={() => setView('merchant-dash')} className={view==='merchant-dash'?'text-indigo-600':'text-slate-300 transition-colors'}><User/></button>
      </nav>

      {/* Payment Modal */}
      {showPayment && selectedDrop && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm animate-in fade-in" onClick={() => setShowPayment(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-t-[50px] p-10 animate-in slide-in-from-bottom shadow-2xl">
            <h3 className="text-2xl font-black text-center mb-8 italic tracking-tighter uppercase text-slate-800">Zelle Pay</h3>
            <div className="bg-slate-50 rounded-[48px] p-10 flex flex-col items-center border border-slate-100 mb-8 shadow-inner">
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Zelle:${selectedDrop.zelleId}`} className="w-48 h-48 mb-6 rounded-3xl shadow-lg border-4 border-white" alt="QR" />
               <p className="font-mono font-black text-indigo-600 text-xs tracking-tighter bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">{selectedDrop.zelleId}</p>
            </div>
            <button onClick={() => setShowPayment(false)} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black uppercase text-xs tracking-widest active:scale-95 transition-transform">Done Paying</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .animate-in { animation: fadeIn 0.3s ease-out; }
        .fade-in { animation: fadeIn 0.5s ease-out; }
        .slide-in-from-bottom { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .slide-in-from-right { animation: slideRight 0.3s ease-out; }
        .slide-in-from-left { animation: slideLeft 0.3s ease-out; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
