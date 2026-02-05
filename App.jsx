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
  MessageSquare, Send, Bell, Search
} from 'lucide-react';

// --- Secure Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [memoText, setMemoText] = useState("");
  
  // New: Search State
  const [searchTerm, setSearchTerm] = useState("");

  const [newDrop, setNewDrop] = useState({
    title: '', locationName: '', zelleId: '', images: [], status: 'live'
  });

  // --- 1. Authentication ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- 2. Data Subscriptions ---
  useEffect(() => {
    if (!user) return;
    
    const dropsQ = query(collection(db, 'artifacts', appId, 'public', 'data', 'drops'));
    const unsubDrops = onSnapshot(dropsQ, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setDrops(docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });

    const memosQ = query(collection(db, 'artifacts', appId, 'public', 'data', 'memos'));
    const unsubMemos = onSnapshot(memosQ, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMemos(docs.filter(m => m.merchantId === user.uid));
    });

    return () => { unsubDrops(); unsubMemos(); };
  }, [user]);

  // --- 3. Filter Logic (Find Function) ---
  const filteredDrops = drops.filter(drop => {
    const search = searchTerm.toLowerCase();
    return (
      drop.title.toLowerCase().includes(search) || 
      drop.locationName.toLowerCase().includes(search)
    );
  });

  // --- 4. Actions ---
  const handleSendMemo = async () => {
    if (!memoText.trim() || !selectedDrop) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'memos'), {
        text: memoText,
        merchantId: selectedDrop.merchantId,
        dropTitle: selectedDrop.title,
        timestamp: serverTimestamp(),
      });
      setMemoText("");
      alert("Memo sent!");
    } catch (err) { console.error(err); }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    setIsUploading(true);
    const uploadedUrls = [];
    for (let file of files) {
      const storageRef = ref(storage, `artifacts/${appId}/drops/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      uploadedUrls.push(url);
    }
    setNewDrop(prev => ({ ...prev, images: [...prev.images, ...uploadedUrls].slice(0, 5) }));
    setIsUploading(false);
  };

  const handlePostDrop = async (e) => {
    e.preventDefault();
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'drops'), {
        ...newDrop, merchantId: user.uid, lat: pos.coords.latitude, lng: pos.coords.longitude, createdAt: serverTimestamp(),
      });
      setView('explore');
      setNewDrop({ title: '', locationName: '', zelleId: '', images: [], status: 'live' });
    });
  };

  // --- 5. Map View ---
  const MapView = () => {
    const mapInstance = useRef(null);
    useEffect(() => {
      const init = () => {
        if (mapInstance.current || !window.L) return;
        const map = window.L.map('map-element', { zoomControl: false }).setView([40.7128, -74.0060], 13);
        mapInstance.current = map;
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
        
        // Use filteredDrops so Map Pins respond to Search
        filteredDrops.filter(d => d.status === 'live').forEach(drop => {
          if (!drop.lat || !drop.lng) return;
          window.L.marker([drop.lat, drop.lng]).addTo(map).on('click', () => { setSelectedDrop(drop); setView('shop-detail'); });
        });

        navigator.geolocation.getCurrentPosition((pos) => {
            map.setView([pos.coords.latitude, pos.coords.longitude], 14);
        });
      };
      
      if (!window.L) {
        const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = init; document.head.appendChild(s);
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l);
      } else init();
    }, [filteredDrops]); // Map updates when search changes
    
    return <div id="map-element" className="h-full w-full"></div>;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans max-w-md mx-auto border-x border-slate-200 shadow-2xl relative overflow-hidden text-slate-900">
      
      {/* Header */}
      <header className="bg-white px-6 pt-12 pb-4 sticky top-0 z-30 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-indigo-600">PopPop Go</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
             <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> {filteredDrops.length} Results
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDisplayMode(displayMode === 'list' ? 'map' : 'list')} className="w-10 h-10 rounded-2xl flex items-center justify-center border bg-slate-100 border-slate-200">
            {displayMode === 'list' ? <MapIcon className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
          </button>
          <button onClick={() => setView('merchant-dash')} className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200 relative">
             <User className="w-5 h-5 text-slate-500" />
             {memos.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>}
          </button>
        </div>
      </header>

      {/* Main View */}
      <main className="flex-1 overflow-y-auto relative">
        
        {view === 'explore' && (
          <>
            {/* Search Bar */}
            <div className="p-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-20">
               <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Find items, areas, or merchants..."
                    className="w-full pl-12 pr-12 py-4 bg-white border border-slate-200 rounded-[24px] text-sm font-medium outline-none focus:ring-4 ring-indigo-500/10 transition-all shadow-sm"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 bg-slate-100 rounded-full">
                       <X className="w-3 h-3 text-slate-500" />
                    </button>
                  )}
               </div>
            </div>

            {displayMode === 'list' ? (
              <div className="px-4 space-y-4 pb-32">
                {filteredDrops.length === 0 && (
                  <div className="py-20 text-center opacity-30 italic text-sm">No results for "{searchTerm}"</div>
                )}
                {filteredDrops.map(drop => (
                  <div key={drop.id} onClick={() => { if(drop.status === 'live') { setSelectedDrop(drop); setView('shop-detail'); } }} className={`bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100 ${drop.status !== 'live' ? 'opacity-50 grayscale' : ''}`}>
                    <div className="relative h-64"><img src={drop.images?.[0]} className="w-full h-full object-cover" /></div>
                    <div className="p-5 flex justify-between items-center">
                      <div><h3 className="font-bold text-lg">{drop.title}</h3><p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3 text-red-500" /> {drop.locationName}</p></div>
                      <ChevronRight className="text-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <MapView />
            )}
          </>
        )}

        {view === 'shop-detail' && selectedDrop && (
          <div className="pb-40 bg-white min-h-screen animate-in slide-in-from-right">
             <div className="relative h-[450px] overflow-x-auto snap-x flex scrollbar-hide">
                {(selectedDrop.images || []).map((img, i) => (<img key={i} src={img} className="w-full h-full object-cover snap-center shrink-0" />))}
                <button onClick={() => setView('explore')} className="absolute top-12 left-6 bg-white/90 p-3 rounded-full shadow-lg z-20"><ChevronLeft /></button>
             </div>
             <div className="p-8 -mt-10 bg-white rounded-t-[48px] relative z-10 space-y-6">
                <h2 className="text-3xl font-black">{selectedDrop.title}</h2>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                   <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase">Direct Memo to Merchant</div>
                   <div className="flex gap-2">
                      <input value={memoText} onChange={e => setMemoText(e.target.value)} placeholder="Ask a question..." className="flex-1 p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white" />
                      <button onClick={handleSendMemo} className="bg-indigo-600 text-white p-3 rounded-xl"><Send className="w-4 h-4" /></button>
                   </div>
                </div>
                <div className="bg-indigo-600 p-6 rounded-3xl flex justify-between items-center text-white shadow-xl shadow-indigo-100">
                   <div><p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Pay via Zelle</p><p className="font-bold">{selectedDrop.zelleId}</p></div>
                   <button onClick={() => setShowPayment(true)} className="bg-white/20 p-4 rounded-2xl"><QrCode /></button>
                </div>
             </div>
          </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-40">
            <h2 className="text-3xl font-black">Merchant Studio</h2>
            <div className="space-y-4">
              <h3 className="font-bold text-sm uppercase text-slate-400 tracking-widest">Inbox ({memos.length})</h3>
              {memos.map(memo => (
                <div key={memo.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative group">
                  <p className="text-[10px] font-black text-indigo-500 uppercase mb-1">RE: {memo.dropTitle}</p>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed">"{memo.text}"</p>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'memos', memo.id))} className="absolute top-4 right-4 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="space-y-4 pt-6 border-t border-slate-100">
              <h3 className="font-bold text-sm uppercase text-slate-400 tracking-widest">My Active Spots</h3>
              {drops.filter(d => d.merchantId === user?.uid).map(myDrop => (
                <div key={myDrop.id} className="bg-white p-4 rounded-3xl border border-slate-200 flex items-center gap-4">
                  <img src={myDrop.images?.[0]} className="w-14 h-14 rounded-xl object-cover" />
                  <div className="flex-1 overflow-hidden"><p className="font-bold text-sm truncate">{myDrop.title}</p></div>
                  <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drops', myDrop.id), { status: myDrop.status === 'live' ? 'sold-out' : 'live' })} className={`p-3 rounded-xl ${myDrop.status === 'live' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}><Power className="w-5 h-5" /></button>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drops', myDrop.id))} className="p-3 bg-red-50 text-red-400 rounded-xl"><Trash2 className="w-5 h-5" /></button>
                </div>
              ))}
              <button onClick={() => setView('post')} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black">+ DROP NEW SPOT</button>
            </div>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-6 pb-40 animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center"><h2 className="text-3xl font-black">Drop a Spot</h2><button onClick={()=>setView('explore')}><X /></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                 {newDrop.images.map((img, i) => (
                   <div key={i} className="aspect-square rounded-2xl overflow-hidden relative border border-slate-200">
                      <img src={img} className="w-full h-full object-cover" />
                      <button onClick={() => setNewDrop(prev => ({...prev, images: prev.images.filter((_, idx)=>idx!==i)}))} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><X className="w-3 h-3" /></button>
                   </div>
                 ))}
                 {newDrop.images.length < 5 && (
                   <label className="aspect-square rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer">
                      {isUploading ? <Loader2 className="animate-spin" /> : <Plus />}
                      <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                   </label>
                 )}
              </div>
              <input required value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title:e.target.value})} placeholder="Shop Name" className="w-full p-4 rounded-2xl border border-slate-200 font-bold" />
              <input required value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName:e.target.value})} placeholder="Location Hint (e.g. Near Big Oak)" className="w-full p-4 rounded-2xl border border-slate-200 font-bold" />
              <input required value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId:e.target.value})} placeholder="Zelle Phone or Email" className="w-full p-4 rounded-2xl border border-slate-200 font-bold" />
              <button onClick={handlePostDrop} className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black shadow-xl">GO LIVE NOW</button>
            </div>
          </div>
        )}
      </main>

      {/* Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-[32px] py-4 px-10 flex justify-between items-center z-40">
        <button onClick={() => {setView('explore'); setDisplayMode('list');}} className={view === 'explore' && displayMode === 'list' ? 'text-indigo-600' : 'text-slate-300'}><ShoppingBag /></button>
        <button onClick={() => setView('post')} className="bg-indigo-600 text-white p-5 rounded-[24px] shadow-lg -mt-16 active:scale-90 transition-transform"><Plus className="w-7 h-7" /></button>
        <button onClick={() => setView('merchant-dash')} className={view === 'merchant-dash' ? 'text-indigo-600' : 'text-slate-300'}><User /></button>
      </nav>

      {/* Payment Modal */}
      {showPayment && selectedDrop && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 animate-in fade-in">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onClick={() => setShowPayment(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-t-[48px] p-8 animate-in slide-in-from-bottom">
            <h3 className="text-2xl font-black text-center mb-8 italic tracking-tighter">ZELLE INSTANT</h3>
            <div className="bg-slate-50 rounded-[48px] p-10 flex flex-col items-center border border-slate-100 mb-8 shadow-inner">
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Zelle:${selectedDrop.zelleId}`} className="w-48 h-48 mb-6 rounded-xl shadow-lg border-4 border-white" alt="QR" />
               <p className="font-mono font-black text-indigo-600 text-xs">{selectedDrop.zelleId}</p>
            </div>
            <button onClick={() => setShowPayment(false)} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black uppercase tracking-widest text-xs">I've Paid</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-in { animation: fadeIn 0.3s ease-out; }
        .slide-in-from-bottom { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .slide-in-from-right { animation: slideRight 0.3s ease-out; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
