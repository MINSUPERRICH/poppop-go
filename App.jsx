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
  Car, AlertCircle, Camera, Check, Info
} from 'lucide-react';

// --- CONFIGURATION ---
const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined') {
    try { return JSON.parse(__firebase_config); } catch (e) { }
  }
  try {
    const env = import.meta.env || {};
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID
    };
  } catch (e) { return {}; }
};

const firebaseConfig = getFirebaseConfig();

let popApp, popAuth, popDb, popStorage;
if (firebaseConfig.apiKey) {
  try {
    popApp = initializeApp(firebaseConfig);
    popAuth = getAuth(popApp);
    popDb = getFirestore(popApp);
    popStorage = getStorage(popApp);
  } catch (e) { console.error("Firebase startup fail", e); }
}

const APP_PATH_ID = "poppop-go-production";

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore'); 
  const [displayMode, setDisplayMode] = useState('list'); 
  const [drops, setDrops] = useState([]);
  const [memos, setMemos] = useState([]);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [memoText, setMemoText] = useState("");
  const [loyaltyUnlocked, setLoyaltyUnlocked] = useState(false);
  const [menuItemInput, setMenuItemInput] = useState({ name: '', price: '' });
  const [errorMsg, setErrorMsg] = useState(null);

  const [newDrop, setNewDrop] = useState({
    title: '', locationName: '', zelleId: '', images: [], status: 'live', type: 'static', hasCoupon: true, menu: [] 
  });

  // 1. Auth Sync
  useEffect(() => {
    if (!popAuth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(popAuth, __initial_auth_token);
        } else {
          await signInAnonymously(popAuth);
        }
      } catch (err) { 
        setErrorMsg(`Login Failed: ${err.message}`);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(popAuth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Data Sync
  useEffect(() => {
    if (!user || !popDb) return;
    const dropsQ = query(collection(popDb, 'artifacts', APP_PATH_ID, 'public', 'data', 'drops'));
    const unsubDrops = onSnapshot(dropsQ, (snap) => {
      setDrops(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
    }, (err) => {
      if (err.code === 'permission-denied') setErrorMsg("DATABASE LOCKED: Update your Firestore Rules in Firebase Console.");
    });
    
    const memosQ = query(collection(popDb, 'artifacts', APP_PATH_ID, 'public', 'data', 'memos'));
    const unsubMemos = onSnapshot(memosQ, (snap) => {
      setMemos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.merchantId === user.uid));
    });
    
    return () => { unsubDrops(); unsubMemos(); };
  }, [user]);

  // Actions
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!popStorage || files.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(1);
    
    try {
      for (let file of files) {
        const sRef = ref(popStorage, `artifacts/${APP_PATH_ID}/drops/${Date.now()}_${file.name}`);
        const snap = await uploadBytes(sRef, file);
        const downloadUrl = await getDownloadURL(snap.ref);
        
        setNewDrop(prev => ({ 
          ...prev, 
          images: [...prev.images, downloadUrl].slice(0, 5) 
        }));
        setUploadProgress(100);
      }
    } catch (err) {
      setErrorMsg(`Photo Upload Failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handlePostDrop = async (e) => {
    e.preventDefault();
    // 1. Debug Alert
    alert("Starting publish process..."); 
    
    if (!popDb || !user) {
      alert("Database not connected. Reloading...");
      window.location.reload();
      return;
    }
    if (newDrop.images.length === 0) {
      alert("Please upload a photo first.");
      return;
    }

    setIsPosting(true);

    try {
      // 2. GPS Step
      let lat = 40.7128; // Default Fallback (NYC)
      let lng = -74.0060;
      
      try {
         const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
         });
         lat = position.coords.latitude;
         lng = position.coords.longitude;
         alert("GPS Location Found!"); 
      } catch (gpsErr) {
         alert("GPS Failed/Timed out. Using default location.");
         console.warn("GPS Fail", gpsErr);
      }
      
      // 3. Save Step
      alert("Saving to Database...");
      await addDoc(collection(popDb, 'artifacts', APP_PATH_ID, 'public', 'data', 'drops'), {
        ...newDrop,
        merchantId: user.uid,
        lat: lat,
        lng: lng,
        createdAt: serverTimestamp(),
      });
      
      alert("Success! Spot is Live.");
      setView('explore');
      setNewDrop({ title: '', locationName: '', zelleId: '', images: [], status: 'live', type: 'static', hasCoupon: true, menu: [] });

    } catch (err) {
      console.error("Critical Post Error:", err);
      alert(`FAILED: ${err.message}`);
      if (err.code === 'permission-denied') {
         setErrorMsg("DATABASE PERMISSION DENIED. Check Rules.");
      }
    } finally {
      setIsPosting(false);
    }
  };

  const handleUberRide = (drop) => {
    const url = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${drop.lat}&dropoff[longitude]=${drop.lng}&dropoff[nickname]=${encodeURIComponent(drop.title)}`;
    window.open(url, '_blank');
  };

  const shareToSocial = async (drop, platform) => {
    const text = `🔥 DEAL: Visit ${drop.title} at ${drop.locationName}! Menu live on PopPop Go. https://poppopnow.com`;
    try {
      await navigator.clipboard.writeText(text);
      if (platform === 'instagram') window.location.href = 'instagram://camera';
      if (drop.hasCoupon) setLoyaltyUnlocked(true);
      alert("Text copied! Paste it in your story.");
    } catch (err) { console.error(err); }
  };

  const MapView = () => {
    const mapRef = useRef(null);
    useEffect(() => {
      if (mapRef.current || !window.L) return;
      const map = window.L.map('map-el', { zoomControl: false }).setView([40.7128, -74.0060], 13);
      mapRef.current = map;
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
      drops.forEach(d => {
        if (!d.lat) return;
        window.L.marker([d.lat, d.lng]).addTo(map).on('click', () => { setSelectedDrop(d); setView('shop-detail'); });
      });
      navigator.geolocation.getCurrentPosition(p => map.setView([p.coords.latitude, p.coords.longitude], 14));
    }, [drops]);
    return <div id="map-el" className="h-full w-full"></div>;
  };

  if (!firebaseConfig.apiKey) return (
    <div className="h-screen flex items-center justify-center p-10 bg-slate-900 text-white text-center font-sans">
       <div><AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4"/><h2 className="text-xl font-bold">API KEY MISSING</h2><p className="text-slate-400 text-sm mt-2">Check Vercel Env Variables.</p></div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans max-w-md mx-auto border-x border-slate-200 relative overflow-hidden text-slate-900">
      
      {errorMsg && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white p-8 rounded-[32px] shadow-2xl text-center space-y-4 max-w-xs border-2 border-red-50">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
              <p className="font-bold text-slate-800 leading-tight">{errorMsg}</p>
              <button onClick={() => setErrorMsg(null)} className="w-full bg-slate-900 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl">Dismiss</button>
           </div>
        </div>
      )}

      <header className="bg-white/95 backdrop-blur-md px-6 pt-12 pb-4 sticky top-0 z-30 border-b border-slate-100 flex justify-between items-center shadow-sm">
        <div><h1 className="text-2xl font-black text-indigo-600 italic tracking-tighter">PopPop Go</h1></div>
        <div className="flex gap-2">
          <button onClick={() => setDisplayMode(displayMode==='list'?'map':'list')} className="w-10 h-10 rounded-2xl border bg-slate-50 flex items-center justify-center active:scale-90 transition-all shadow-sm">
            {displayMode==='list' ? <MapIcon className="w-5 h-5"/> : <Grid className="w-5 h-5"/>}
          </button>
          <button onClick={() => setView('merchant-dash')} className="w-10 h-10 rounded-2xl border bg-slate-50 flex items-center justify-center relative active:scale-90 transition-all shadow-sm">
            <User className="w-5 h-5 text-slate-400"/>
            {memos.length>0&&<span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative">
        {view === 'explore' && (
          <>
            <div className="p-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-20">
              <div className="relative group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Find local spots..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[24px] text-sm font-medium outline-none shadow-sm focus:ring-2 ring-indigo-500/10"/></div>
            </div>
            {displayMode === 'list' ? (
              <div className="px-4 space-y-4 pb-32">
                {drops.length === 0 && <div className="py-20 text-center text-slate-300 italic text-sm font-medium">No live spots nearby...</div>}
                {drops.filter(d => d.title?.toLowerCase().includes(searchTerm.toLowerCase())).map(d => (
                  <div key={d.id} onClick={() => { setSelectedDrop(d); setView('shop-detail'); }} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100 active:scale-[0.98] transition-transform">
                    <img src={d.images?.[0] || 'https://images.unsplash.com/photo-1555529669-2269763671c0'} className="h-64 w-full object-cover" />
                    <div className="p-5 flex justify-between items-center">
                      <div>
                        <div className="flex gap-1 mb-1">
                          {d.type === 'food-truck' && <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-2 py-0.5 rounded-md uppercase">Truck</span>}
                        </div>
                        <h3 className="font-bold text-lg tracking-tight">{d.title}</h3>
                        <p className="text-xs text-slate-400 font-bold italic flex items-center gap-1"><MapPin className="w-3 h-3 text-red-500"/> {d.locationName}</p>
                      </div>
                      <ChevronRight className="text-slate-200"/>
                    </div>
                  </div>
                ))}
              </div>
            ) : <MapView />}
          </>
        )}

        {view === 'shop-detail' && selectedDrop && (
          <div className="pb-40 bg-white min-h-screen animate-in slide-in-from-right font-sans">
            <div className="relative h-80 flex overflow-x-auto snap-x scrollbar-hide">
              {selectedDrop.images?.map((img, i) => <img key={i} src={img} className="w-full h-full object-cover snap-center shrink-0" />)}
              <button onClick={() => setView('explore')} className="absolute top-12 left-6 bg-white/90 p-3 rounded-full shadow-lg z-20"><ChevronLeft /></button>
            </div>
            <div className="p-8 -mt-10 bg-white rounded-t-[48px] relative z-10 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center"><h2 className="text-3xl font-black italic tracking-tighter">{selectedDrop.title}</h2><div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Live Now</div></div>
              <div className="flex gap-3">
                <button onClick={() => window.open(`https://maps.google.com/?q=${selectedDrop.lat},${selectedDrop.lng}`)} className="flex-1 bg-slate-100 p-4 rounded-3xl flex flex-col items-center gap-1 active:bg-slate-200 transition-colors shadow-sm font-black"><Navigation className="w-6 h-6 text-slate-600"/><span className="uppercase text-[10px]">Open Maps</span></button>
                <button onClick={() => handleUberRide(selectedDrop)} className="flex-1 bg-black p-4 rounded-3xl flex flex-col items-center gap-1 active:scale-95 transition-transform shadow-xl shadow-slate-200 text-white font-black"><Car className="w-6 h-6 text-white"/><span className="uppercase text-[10px]">Ride Uber</span></button>
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1 italic font-black"><ShoppingBag className="w-3 h-3" /> Merchant Menu</h3>
                {selectedDrop.menu?.map((m, i) => (
                  <div key={i} className="flex justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in duration-300 font-bold"><span className="text-slate-700">{m.name}</span><span className="text-indigo-600 tracking-tighter">${m.price}</span></div>
                ))}
              </div>
              <div className="bg-slate-900 p-6 rounded-[32px] flex justify-between items-center text-white active:bg-black transition-colors shadow-xl" onClick={()=>setShowPayment(true)}>
                <div className="text-left"><p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-1 italic font-black underline decoration-indigo-400">Scan to Pay Merchant</p><p className="font-bold text-lg tracking-tight underline decoration-indigo-400">{selectedDrop.zelleId}</p></div>
                <div className="bg-white/10 p-3 rounded-2xl shadow-inner"><QrCode /></div>
              </div>
            </div>
          </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-40 animate-in fade-in">
            <h2 className="text-3xl font-black italic underline decoration-indigo-200 tracking-tighter font-black">Merchant Hub</h2>
            <div className="space-y-4 pt-6">
              <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest italic font-black">Manage My Spots</h3>
              {drops.filter(d => d.merchantId === user?.uid).map(myDrop => (
                <div key={myDrop.id} className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between"><div className="flex items-center gap-3"><img src={myDrop.images?.[0]} className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-sm" /><p className="font-black text-lg tracking-tighter">{myDrop.title}</p></div><button onClick={() => deleteDoc(doc(popDb, 'artifacts', APP_PATH_ID, 'public', 'data', 'drops', myDrop.id))} className="p-3 bg-red-50 text-red-400 rounded-xl active:bg-red-100 transition-colors shadow-sm"><Trash2 className="w-5 h-5" /></button></div>
              ))}
              <button onClick={() => setView('post')} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black shadow-xl uppercase tracking-widest text-xs active:scale-95 shadow-indigo-100 transition-transform">+ DROP NEW SPOT</button>
            </div>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-6 pb-40 animate-in slide-in-from-bottom font-sans">
            <div className="flex justify-between items-center"><h2 className="text-3xl font-black italic tracking-tighter">Go Live</h2><button onClick={()=>setView('explore')}><X className="text-slate-300 hover:text-red-500"/></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                 {newDrop.images.map((img, i) => (
                   <div key={i} className="aspect-square rounded-2xl overflow-hidden relative border border-slate-100 animate-in zoom-in shadow-sm">
                     <img src={img} className="w-full h-full object-cover" />
                     {i === 0 && <Check className="absolute bottom-1 right-1 w-3 h-3 bg-indigo-600 text-white rounded-full p-0.5 shadow-md" />}
                     <button onClick={() => setNewDrop(p => ({...p, images: p.images.filter((_, idx)=>idx!==i)}))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md"><X className="w-2 h-2"/></button>
                   </div>
                 ))}
                 {newDrop.images.length < 5 && (
                   <label className="aspect-square rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer relative hover:border-indigo-300 hover:text-indigo-400 transition-all">
                      {isUploading ? <Loader2 className="animate-spin text-indigo-600" /> : <Camera className="w-8 h-8" />}
                      <span className="text-[8px] font-black mt-1 uppercase tracking-tighter font-black">{isUploading ? 'Uploading...' : 'Take Photo'}</span>
                      <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                   </label>
                 )}
              </div>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-4 shadow-inner">
                <button type="button" onClick={() => setNewDrop({...newDrop, type: 'static'})} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all ${newDrop.type === 'static' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><Store className="w-4 h-4" /> POP-UP</button>
                <button type="button" onClick={() => setNewDrop({...newDrop, type: 'food-truck'})} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all ${newDrop.type === 'food-truck' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-400'}`}><Truck className="w-4 h-4" /> TRUCK</button>
              </div>
              <div className="space-y-4">
                 <input required value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title:e.target.value})} placeholder="Shop Name" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none bg-white focus:ring-2 ring-indigo-500/10 transition-all shadow-sm" />
                 <input required value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName:e.target.value})} placeholder="Precisely where are you?" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none bg-white focus:ring-2 ring-indigo-500/10 transition-all shadow-sm" />
                 <input required value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId:e.target.value})} placeholder="Zelle Phone or Email" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none bg-white focus:ring-2 ring-indigo-500/10 transition-all shadow-sm" />
              </div>
              <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3 shadow-sm border-indigo-50">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 font-black"><Tag className="w-3 h-3"/> Quick Menu</p>
                 <div className="flex gap-2">
                    <input value={menuItemInput.name} onChange={e=>setMenuItemInput({...menuItemInput, name: e.target.value})} placeholder="Item" className="flex-1 p-3 rounded-xl border border-slate-100 text-xs font-bold outline-none shadow-inner" />
                    <input value={menuItemInput.price} onChange={e=>setMenuItemInput({...menuItemInput, price: e.target.value})} placeholder="$" className="w-16 p-3 rounded-xl border border-slate-100 text-xs font-bold text-center outline-none shadow-inner" />
                    <button type="button" onClick={() => { if(menuItemInput.name) { setNewDrop({...newDrop, menu: [...newDrop.menu, {...menuItemInput}]}); setMenuItemInput({name:'', price:''}); } }} className="bg-indigo-600 text-white px-3 rounded-xl active:scale-95 transition-all shadow-lg"><Plus className="w-4 h-4" /></button>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {newDrop.menu.map((item, idx) => (
                      <span key={idx} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[9px] font-black flex items-center gap-1 shadow-sm uppercase tracking-tighter border border-indigo-100 font-black">{item.name} ${item.price} <X className="w-2 h-2 cursor-pointer hover:text-red-500" onClick={() => setNewDrop({...newDrop, menu: newDrop.menu.filter((_, i) => i !== idx)})} /></span>
                    ))}
                 </div>
              </div>
              <button 
                onClick={handlePostDrop} 
                disabled={isUploading || isPosting}
                className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black shadow-xl uppercase tracking-widest text-xs active:scale-95 transition-all disabled:bg-slate-300 shadow-indigo-200"
              >
                {isPosting ? 'Connecting to GPS...' : isUploading ? 'Wait for photo...' : 'Go Live on Map'}
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-[32px] py-4 px-10 flex justify-between items-center z-40 shadow-indigo-500/10">
        <button onClick={() => {setView('explore'); setDisplayMode('list');}} className={view==='explore' ? 'text-indigo-600 font-black' : 'text-slate-300 transition-colors'}><ShoppingBag/></button>
        <button onClick={() => setView('post')} className="bg-indigo-600 text-white p-5 rounded-[24px] shadow-lg shadow-indigo-200 -mt-16 active:scale-90 transition-transform"><Plus className="w-7 h-7"/></button>
        <button onClick={() => setView('merchant-dash')} className={view==='merchant-dash' ? 'text-indigo-600 font-black' : 'text-slate-300 transition-colors'}><User/></button>
      </nav>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-in { animation: fadeIn 0.3s ease-out; }
        .slide-in-from-bottom { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .slide-in-from-right { animation: slideRight 0.3s ease-out; }
        .zoom-in { animation: zoomIn 0.2s ease-out; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
