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

// Attempt Init
if (firebaseConfig.apiKey) {
  try {
    popApp = initializeApp(firebaseConfig);
    popAuth = getAuth(popApp);
    popDb = getFirestore(popApp);
    popStorage = getStorage(popApp);
  } catch (e) { console.error("Init Error", e); }
}

const APP_PATH = "poppop-go-production";

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore'); 
  const [displayMode, setDisplayMode] = useState('list'); 
  const [drops, setDrops] = useState([]);
  const [memos, setMemos] = useState([]);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  
  // States
  const [isUploading, setIsUploading] = useState(false);
  const [statusLog, setStatusLog] = useState("System Ready"); // Debug Log
  const [searchTerm, setSearchTerm] = useState("");
  const [memoText, setMemoText] = useState("");
  const [loyaltyUnlocked, setLoyaltyUnlocked] = useState(false);
  const [menuItemInput, setMenuItemInput] = useState({ name: '', price: '' });

  const [newDrop, setNewDrop] = useState({
    title: '', locationName: '', zelleId: '', images: [], status: 'live', type: 'static', hasCoupon: true, menu: [] 
  });

  // 1. Auth
  useEffect(() => {
    if (!popAuth) {
      setStatusLog("Auth Error: Firebase not loaded");
      return;
    }
    signInAnonymously(popAuth).catch(e => setStatusLog("Login Failed: " + e.message));
    return onAuthStateChanged(popAuth, (u) => {
      setUser(u);
      if (u) setStatusLog("User Connected: " + u.uid.slice(0,5));
    });
  }, []);

  // 2. Data
  useEffect(() => {
    if (!user || !popDb) return;
    const qDrops = query(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops'));
    const uDrops = onSnapshot(qDrops, (s) => {
       const list = s.docs.map(d => ({id: d.id, ...d.data()}));
       setDrops(list);
    }, (e) => setStatusLog("DB Error: " + e.message));
    
    // Memos
    const qMemos = query(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'memos'));
    const uMemos = onSnapshot(qMemos, (s) => {
       const list = s.docs.map(d => ({id: d.id, ...d.data()}));
       setMemos(list.filter(m => m.merchantId === user.uid));
    });
    return () => { uDrops(); uMemos(); };
  }, [user]);

  // --- ACTIONS ---

  const handlePostDrop = async () => {
    // 1. Force Alert to prove button works
    alert(`DEBUG STATUS:\nUser: ${user ? 'Yes' : 'No'}\nPhotos: ${newDrop.images.length}\nUploading: ${isUploading}`);

    if (!user) return; // Stop if no user

    // 2. GPS
    let lat = 40.7128;
    let lng = -74.0060;
    
    setStatusLog("Requesting GPS...");
    
    try {
      // Simple GPS call
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setStatusLog("GPS Found. Saving...");
          await saveToDb(pos.coords.latitude, pos.coords.longitude);
        }, 
        async (err) => {
          alert("GPS Failed (" + err.code + "). Saving with default location.");
          await saveToDb(lat, lng);
        },
        { timeout: 10000 }
      );
    } catch (e) {
      alert("System Error: " + e.message);
    }
  };

  const saveToDb = async (lat, lng) => {
    try {
      await addDoc(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops'), {
        ...newDrop,
        merchantId: user.uid,
        lat: lat,
        lng: lng,
        createdAt: serverTimestamp(),
      });
      alert("SUCCESS! Drop saved.");
      setView('explore');
      setNewDrop({ title: '', locationName: '', zelleId: '', images: [], status: 'live', type: 'static', hasCoupon: true, menu: [] });
    } catch (err) {
      alert("SAVE FAILED: " + err.message);
      setStatusLog("Save Failed: " + err.message);
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!popStorage || files.length === 0) return;
    
    setIsUploading(true);
    setStatusLog("Uploading Photo...");
    
    try {
      for (let file of files) {
        const sRef = ref(popStorage, `artifacts/${APP_PATH}/drops/${Date.now()}_${file.name}`);
        const snap = await uploadBytes(sRef, file);
        const url = await getDownloadURL(snap.ref);
        setNewDrop(prev => ({ ...prev, images: [...prev.images, url].slice(0, 5) }));
      }
      setStatusLog("Upload Complete!");
    } catch (err) {
      alert("Upload Error: " + err.message);
      setStatusLog("Upload Error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUberRide = (drop) => window.open(`https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${drop.lat}&dropoff[longitude]=${drop.lng}&dropoff[nickname]=${encodeURIComponent(drop.title)}`, '_blank');
  
  const shareToSocial = async (drop, type) => {
    const txt = `🔥 VISIT: ${drop.title} at ${drop.locationName}! On PopPop Go.`;
    await navigator.clipboard.writeText(txt);
    if (type === 'instagram') window.location.href = 'instagram://camera';
    if (drop.hasCoupon) setLoyaltyUnlocked(true);
    alert("Text copied!");
  };

  // Components
  const MapView = () => {
    const mapRef = useRef(null);
    useEffect(() => {
      if (mapRef.current || !window.L) return;
      const map = window.L.map('map-el', {zoomControl: false}).setView([40.7128, -74.0060], 13);
      mapRef.current = map;
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
      drops.forEach(d => {
         if (d.lat) window.L.marker([d.lat, d.lng]).addTo(map).on('click', () => { setSelectedDrop(d); setView('shop-detail'); });
      });
      navigator.geolocation.getCurrentPosition(p => map.setView([p.coords.latitude, p.coords.longitude], 14));
    }, [drops]);
    return <div id="map-el" className="h-full w-full"></div>;
  };

  if (!firebaseConfig.apiKey) return <div className="p-10 text-center text-white bg-slate-900">Config Error. Check Vercel.</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans max-w-md mx-auto border-x border-slate-200 relative overflow-hidden text-slate-900">
      
      <header className="bg-white/95 backdrop-blur-md px-6 pt-12 pb-4 sticky top-0 z-30 border-b border-slate-100 flex justify-between items-center">
        <h1 className="text-2xl font-black text-indigo-600 italic tracking-tighter">PopPop Go</h1>
        <div className="flex gap-2">
          <button onClick={() => setDisplayMode(displayMode==='list'?'map':'list')} className="w-10 h-10 rounded-2xl border bg-slate-50 flex items-center justify-center active:scale-90 transition-all">{displayMode==='list' ? <MapIcon className="w-5 h-5"/> : <Grid className="w-5 h-5"/>}</button>
          <button onClick={() => setView('merchant-dash')} className="w-10 h-10 rounded-2xl border bg-slate-50 flex items-center justify-center active:scale-90 transition-all relative"><User className="w-5 h-5 text-slate-400"/>{memos.length>0&&<span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>}</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative">
        {view === 'explore' && (
          <>
            <div className="p-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-20"><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Find local spots..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[24px] text-sm font-medium outline-none shadow-sm"/></div></div>
            {displayMode === 'list' ? (
              <div className="px-4 space-y-4 pb-32">
                {drops.length === 0 && <div className="py-20 text-center text-slate-300 italic text-sm">No live spots...</div>}
                {drops.filter(d => d.title?.toLowerCase().includes(searchTerm.toLowerCase())).map(d => (
                  <div key={d.id} onClick={() => { setSelectedDrop(d); setView('shop-detail'); }} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100 active:scale-[0.98] transition-transform">
                    <img src={d.images?.[0]} className="h-64 w-full object-cover" />
                    <div className="p-5">
                      <div className="flex gap-1 mb-1">{d.type==='food-truck' && <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-2 py-0.5 rounded-md">TRUCK</span>}{d.hasCoupon && <span className="bg-pink-100 text-pink-600 text-[8px] font-black px-2 py-0.5 rounded-md">10% OFF</span>}</div>
                      <h3 className="font-bold text-lg">{d.title}</h3>
                      <p className="text-xs text-slate-400 font-bold italic flex items-center gap-1"><MapPin className="w-3 h-3 text-red-500"/> {d.locationName}</p>
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
              <button onClick={() => setView('explore')} className="absolute top-12 left-6 bg-white/90 p-3 rounded-full shadow-lg"><ChevronLeft /></button>
            </div>
            <div className="p-8 -mt-10 bg-white rounded-t-[48px] relative z-10 space-y-6 shadow-2xl">
              <div className="flex justify-between items-center"><h2 className="text-3xl font-black italic">{selectedDrop.title}</h2><div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black">OPEN</div></div>
              <div className="flex gap-3">
                <button onClick={() => window.open(`https://maps.google.com/?q=${selectedDrop.lat},${selectedDrop.lng}`)} className="flex-1 bg-slate-100 p-4 rounded-3xl flex flex-col items-center font-black text-xs"><Navigation className="w-6 h-6 mb-1"/>MAPS</button>
                <button onClick={() => handleUberRide(selectedDrop)} className="flex-1 bg-black text-white p-4 rounded-3xl flex flex-col items-center font-black text-xs"><Car className="w-6 h-6 mb-1"/>UBER</button>
              </div>
              <button onClick={() => shareToSocial(selectedDrop, 'instagram')} className="w-full bg-gradient-to-r from-pink-500 to-indigo-600 p-5 rounded-[32px] text-white flex justify-between items-center shadow-xl active:scale-95 transition-all">
                <div className="flex items-center gap-3"><Instagram className="w-6 h-6"/><div className="text-left font-bold text-sm">Share for 10% OFF</div></div>
                {loyaltyUnlocked ? <div className="bg-white/20 px-3 py-1 rounded-lg text-xs font-black">ANT10</div> : <Plus className="opacity-50"/>}
              </button>
              <div className="bg-slate-900 p-6 rounded-[32px] flex justify-between items-center text-white active:bg-black shadow-xl" onClick={()=>setShowPayment(true)}>
                <div className="text-left"><p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-1 italic">Zelle Pay</p><p className="font-bold text-lg underline decoration-indigo-400">{selectedDrop.zelleId}</p></div>
                <div className="bg-white/10 p-3 rounded-2xl"><QrCode /></div>
              </div>
              <div className="space-y-2">
                 <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Inventory</h3>
                 {selectedDrop.menu?.map((m,i)=>(<div key={i} className="flex justify-between p-4 border rounded-2xl"><span className="font-bold">{m.name}</span><span className="text-indigo-600 font-black">${m.price}</span></div>))}
              </div>
            </div>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-6 pb-40 animate-in slide-in-from-bottom font-sans">
            <div className="flex justify-between items-center"><h2 className="text-3xl font-black italic">Go Live</h2><button onClick={()=>setView('explore')}><X/></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                 {newDrop.images.map((img, i) => (<div key={i} className="aspect-square rounded-2xl overflow-hidden relative border border-slate-100 shadow-inner"><img src={img} className="w-full h-full object-cover" /><Check className="absolute bottom-1 right-1 w-4 h-4 bg-indigo-600 text-white rounded-full p-0.5"/></div>))}
                 {newDrop.images.length < 5 && (
                   <label className="aspect-square rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer active:bg-slate-200">
                      {isUploading ? <Loader2 className="animate-spin" /> : <Camera className="w-8 h-8" />}
                      <span className="text-[8px] font-black mt-1 uppercase">{isUploading ? 'Loading...' : 'Take Photo'}</span>
                      <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                   </label>
                 )}
              </div>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-4">
                <button type="button" onClick={() => setNewDrop({...newDrop, type: 'static'})} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black ${newDrop.type === 'static' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><Store className="w-4 h-4" /> POP-UP</button>
                <button type="button" onClick={() => setNewDrop({...newDrop, type: 'food-truck'})} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black ${newDrop.type === 'food-truck' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-400'}`}><Truck className="w-4 h-4" /> TRUCK</button>
              </div>
              <div className="space-y-4">
                 <input required value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title:e.target.value})} placeholder="Shop Name" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none" />
                 <input required value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName:e.target.value})} placeholder="Location Hint" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none" />
                 <input required value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId:e.target.value})} placeholder="Zelle ID" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none" />
              </div>
              
              {/* SYSTEM STATUS BOX */}
              <div className="bg-slate-900 text-white p-4 rounded-xl text-xs font-mono">
                 <p className="opacity-50 uppercase tracking-widest mb-1">System Status</p>
                 <p className={statusLog.includes("Error") ? "text-red-400 font-bold" : "text-green-400 font-bold"}>{statusLog}</p>
                 <p className="mt-1">Photos: {newDrop.images.length} / 5</p>
              </div>

              <button 
                onClick={handlePostDrop} 
                className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black shadow-xl uppercase tracking-widest text-xs active:scale-95 transition-all"
              >
                GO LIVE ON MAP
              </button>
            </div>
          </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-40">
            <h2 className="text-3xl font-black italic tracking-tighter">My Hub</h2>
            <div className="space-y-4">
              <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest">Active Spots</h3>
              {drops.filter(d => d.merchantId === user?.uid).map(myDrop => (
                <div key={myDrop.id} className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between"><span className="font-bold">{myDrop.title}</span><button onClick={() => deleteDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', myDrop.id))}><Trash2 className="text-red-400"/></button></div>
              ))}
              <button onClick={() => setView('post')} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black shadow-xl text-xs uppercase">+ NEW DROP</button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-[32px] py-4 px-10 flex justify-between items-center z-40">
        <button onClick={() => {setView('explore'); setDisplayMode('list');}} className={view==='explore'?'text-indigo-600':'text-slate-300'}><ShoppingBag/></button>
        <button onClick={() => setView('post')} className="bg-indigo-600 text-white p-5 rounded-[24px] shadow-lg -mt-16 active:scale-90 transition-transform"><Plus className="w-7 h-7"/></button>
        <button onClick={() => setView('merchant-dash')} className={view==='merchant-dash'?'text-indigo-600':'text-slate-300'}><User/></button>
      </nav>

      {showPayment && <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-10"><div className="bg-white p-10 rounded-3xl text-center"><h3 className="font-black text-2xl mb-4">Paid?</h3><button onClick={()=>setShowPayment(false)} className="bg-black text-white px-8 py-3 rounded-full">Yes</button></div></div>}
    </div>
  );
};

export default App;
