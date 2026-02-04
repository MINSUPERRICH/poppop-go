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
  MapPin, Camera, User, ShoppingBag, Zap, 
  QrCode, Heart, ChevronLeft, Plus, X, 
  Power, Shield, Map as MapIcon, Grid,
  ChevronRight, Loader2, Trash2, Navigation, Send
} from 'lucide-react';

// --- Secure Firebase Configuration ---
// Using the global variable provided by the environment to keep keys out of source code.
const firebaseConfig = JSON.parse(__firebase_config);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'poppop-go-production';

// --- Sub-Component: Privacy Policy ---
const PrivacyPolicyView = ({ onBack }) => (
  <div className="p-8 pb-32 bg-white min-h-screen animate-in slide-in-from-right">
    <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold mb-8">
      <ChevronLeft className="w-5 h-5" /> BACK
    </button>
    <h1 className="text-3xl font-black mb-6 tracking-tighter text-slate-900">Privacy Policy</h1>
    <div className="space-y-6 text-slate-600 text-sm leading-relaxed">
      <section>
        <h2 className="font-bold text-slate-900 uppercase text-xs mb-2">1. Location & Data</h2>
        <p>PopPop Go collects approximate location data to display nearby shops on the interactive map. We collect Merchant IDs to manage shop ownership.</p>
      </section>
      <section>
        <h2 className="font-bold text-slate-900 uppercase text-xs mb-2">2. Media Storage</h2>
        <p>Merchant photos are uploaded to Firebase Storage. These are public for users to view but can only be managed/deleted by the merchant who uploaded them.</p>
      </section>
      <section>
        <h2 className="font-bold text-slate-900 uppercase text-xs mb-2">3. Financial Transactions</h2>
        <p>All payments occur via third-party Zelle links. PopPop Go does not process, see, or store your bank details or transaction history.</p>
      </section>
    </div>
  </div>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore'); // explore, shop-detail, post, merchant, privacy
  const [displayMode, setDisplayMode] = useState('list'); // list or map
  const [drops, setDrops] = useState([]);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // New Drop Form State
  const [newDrop, setNewDrop] = useState({
    title: '',
    locationName: '',
    zelleId: '',
    images: [], 
    status: 'live'
  });

  // --- 1. Authentication ---
  useEffect(() => {
    const initAuth = async () => {
      // Prioritize the initial auth token if available, otherwise sign in anonymously
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

  // --- 2. Real-time Data Subscription ---
  useEffect(() => {
    if (!user) return;
    // Always use the strict path requirement for Firestore
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'drops'));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in memory as per Rule 2 (Avoid complex Firestore queries)
      setDrops(docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    }, (err) => console.error("Firestore Error:", err));
  }, [user]);

  // --- 3. Multi-Image Upload Logic ---
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);
    const uploadedUrls = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Store in a path following the appId structure
      const storageRef = ref(storage, `artifacts/${appId}/drops/${Date.now()}_${file.name}`);
      try {
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        uploadedUrls.push(url);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (err) { console.error("Upload failed:", err); }
    }
    setNewDrop(prev => ({ ...prev, images: [...prev.images, ...uploadedUrls].slice(0, 5) }));
    setIsUploading(false);
  };

  const handlePostDrop = async (e) => {
    e.preventDefault();
    if (!user || newDrop.images.length === 0) return;
    
    // Auth check before write
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'drops'), {
          ...newDrop,
          merchantId: user.uid,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          createdAt: serverTimestamp(),
        });
        setView('explore');
        setNewDrop({ title: '', locationName: '', zelleId: '', images: [], status: 'live' });
      } catch (err) { console.error("Save error:", err); }
    }, () => alert("Please allow GPS access to drop your spot!"));
  };

  // --- 4. Interactive Map Logic ---
  const MapView = () => {
    const mapInstance = useRef(null);

    useEffect(() => {
      const loadLeaflet = () => {
        if (!window.L) {
          const link = document.createElement('link');
          link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = initMap;
          document.head.appendChild(script);
        } else { initMap(); }
      };

      const initMap = () => {
        if (mapInstance.current || !window.L) return;
        const map = window.L.map('map-element', { zoomControl: false }).setView([40.7128, -74.0060], 13);
        mapInstance.current = map;
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);

        drops.filter(d => d.status === 'live').forEach(drop => {
          if (!drop.lat || !drop.lng) return;
          const marker = window.L.marker([drop.lat, drop.lng]).addTo(map);
          marker.bindPopup(`
            <div style="font-family: sans-serif; padding: 5px;">
              <b style="font-size: 14px;">${drop.title}</b><br/>
              <span style="color: #64748b; font-size: 11px;">${drop.locationName}</span><br/>
              <button onclick="window.dispatchEvent(new CustomEvent('viewShop', {detail: '${drop.id}'}))" 
                      style="margin-top: 8px; width: 100%; background: #4f46e5; color: white; border: none; padding: 8px; border-radius: 8px; font-weight: bold; cursor: pointer;">
                VIEW SHOP
              </button>
            </div>
          `);
        });

        navigator.geolocation.getCurrentPosition((pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 14);
          window.L.circle([pos.coords.latitude, pos.coords.longitude], { color: '#4f46e5', radius: 300 }).addTo(map);
        });
      };

      loadLeaflet();
      const handleViewShop = (e) => {
        const drop = drops.find(d => d.id === e.detail);
        if (drop) { setSelectedDrop(drop); setView('shop-detail'); }
      };
      window.addEventListener('viewShop', handleViewShop);
      return () => {
        window.removeEventListener('viewShop', handleViewShop);
        if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
      };
    }, [drops]);

    return <div id="map-element" className="h-full w-full z-0"></div>;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans max-w-md mx-auto border-x border-slate-200 shadow-2xl relative overflow-hidden">
      
      {/* App Header */}
      {view !== 'privacy' && (
        <header className="bg-white/95 backdrop-blur-md px-6 pt-12 pb-4 sticky top-0 z-30 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-indigo-600">PopPop Go</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> {drops.filter(d=>d.status==='live').length} Active Drops
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setDisplayMode(displayMode === 'list' ? 'map' : 'list')}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all ${displayMode === 'map' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
            >
              {displayMode === 'list' ? <MapIcon className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
            </button>
            <button onClick={() => setView('merchant-dash')} className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
               <User className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </header>
      )}

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto relative">
        
        {view === 'explore' && displayMode === 'list' && (
          <div className="p-4 space-y-4 pb-32">
            {drops.map(drop => (
              <div 
                key={drop.id} 
                onClick={() => { if(drop.status === 'live') { setSelectedDrop(drop); setView('shop-detail'); } }}
                className={`bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100 ${drop.status !== 'live' ? 'opacity-50 grayscale' : 'active:scale-[0.98] transition-transform'}`}
              >
                <div className="relative h-64">
                  <img src={drop.images?.[0] || 'https://images.unsplash.com/photo-1555529669-2269763671c0'} className="w-full h-full object-cover" />
                  <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-[10px] font-black shadow-lg ${drop.status === 'live' ? 'bg-green-500 text-white' : 'bg-slate-500 text-white'}`}>
                    {drop.status === 'live' ? 'LIVE' : 'SOLD OUT'}
                  </div>
                  {drop.images?.length > 1 && (
                    <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                      +{drop.images.length - 1} MORE ITEMS
                    </div>
                  )}
                </div>
                <div className="p-5 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">{drop.title}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3 text-red-500" /> {drop.locationName}</p>
                  </div>
                  <ChevronRight className="text-slate-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {displayMode === 'map' && view === 'explore' && <MapView />}

        {view === 'shop-detail' && selectedDrop && (
          <div className="pb-32 bg-white min-h-screen animate-in slide-in-from-right">
             <div className="relative h-[500px] overflow-x-auto snap-x flex scrollbar-hide">
                {(selectedDrop.images || []).map((img, i) => (
                  <img key={i} src={img} className="w-full h-full object-cover snap-center shrink-0" />
                ))}
                <button onClick={() => setView('explore')} className="absolute top-12 left-6 bg-white/90 p-3 rounded-full shadow-lg z-20"><ChevronLeft /></button>
                <div className="absolute bottom-16 right-6 bg-indigo-600 text-white text-[10px] font-black px-4 py-2 rounded-full z-20 shadow-xl flex items-center gap-2">
                  <Navigation className="w-3 h-3" /> SWIPE PHOTOS
                </div>
             </div>
             <div className="p-8 -mt-10 bg-white rounded-t-[48px] relative z-10 space-y-6 shadow-2xl">
                <div className="flex justify-between items-start">
                  <h2 className="text-3xl font-black">{selectedDrop.title}</h2>
                  <button onClick={() => window.open(`https://maps.google.com/?q=${selectedDrop.lat},${selectedDrop.lng}`)} className="bg-slate-100 p-4 rounded-2xl text-indigo-600"><Navigation /></button>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex justify-between items-center">
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pay via Zelle</p>
                      <p className="font-bold text-indigo-600">{selectedDrop.zelleId}</p>
                   </div>
                   <button onClick={() => setShowPayment(true)} className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg"><QrCode /></button>
                </div>
             </div>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-6 pb-40 animate-in slide-in-from-bottom">
            <h2 className="text-3xl font-black">Drop a Spot</h2>
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
                      <span className="text-[8px] font-black mt-1 uppercase">{isUploading ? `${uploadProgress}%` : 'Add Photo'}</span>
                      <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                   </label>
                 )}
              </div>
              <input required value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title:e.target.value})} placeholder="Shop Name" className="w-full p-4 rounded-2xl border border-slate-200 font-bold" />
              <input required value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName:e.target.value})} placeholder="Location Hint (e.g. Near Big Oak Tree)" className="w-full p-4 rounded-2xl border border-slate-200 font-bold" />
              <input required value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId:e.target.value})} placeholder="Zelle Email or Phone" className="w-full p-4 rounded-2xl border border-slate-200 font-bold" />
              <button onClick={handlePostDrop} disabled={isUploading || newDrop.images.length === 0} className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black shadow-xl disabled:opacity-50">
                GO LIVE NOW
              </button>
            </div>
          </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-40">
            <h2 className="text-3xl font-black">Merchant Studio</h2>
            <div className="space-y-4">
              {drops.filter(d => d.merchantId === user?.uid).map(myDrop => (
                <div key={myDrop.id} className="bg-white p-4 rounded-3xl border border-slate-200 flex items-center gap-4">
                  <img src={myDrop.images?.[0]} className="w-16 h-16 rounded-2xl object-cover" />
                  <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-sm truncate">{myDrop.title}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{myDrop.status}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drops', myDrop.id), { status: myDrop.status === 'live' ? 'sold-out' : 'live' })} className={`p-3 rounded-xl ${myDrop.status === 'live' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Power className="w-5 h-5" />
                    </button>
                    <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drops', myDrop.id))} className="p-3 bg-red-50 text-red-400 rounded-xl"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>
              ))}
              <button onClick={() => setView('post')} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black shadow-xl">+ DROP NEW SPOT</button>
              <button onClick={() => setView('privacy')} className="w-full text-slate-300 text-[10px] font-bold uppercase py-4 flex items-center justify-center gap-2">
                <Shield className="w-3 h-3" /> Privacy Policy
              </button>
            </div>
          </div>
        )}

        {view === 'privacy' && <PrivacyPolicyView onBack={() => setView('merchant-dash')} />}
      </main>

      {/* Persistent Nav */}
      {view !== 'privacy' && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-[32px] py-4 px-10 flex justify-between items-center z-40">
          <button onClick={() => {setView('explore'); setDisplayMode('list');}} className={view === 'explore' && displayMode === 'list' ? 'text-indigo-600' : 'text-slate-300'}><ShoppingBag /></button>
          <button onClick={() => setView('post')} className="bg-indigo-600 text-white p-5 rounded-[24px] shadow-lg -mt-16 active:scale-90 transition-transform"><Plus className="w-7 h-7" /></button>
          <button onClick={() => setView('merchant-dash')} className={view === 'merchant-dash' ? 'text-indigo-600' : 'text-slate-300'}><User /></button>
        </nav>
      )}

      {/* Zelle Modal */}
      {showPayment && selectedDrop && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 animate-in fade-in">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onClick={() => setShowPayment(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-t-[48px] p-8 animate-in slide-in-from-bottom">
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-2xl font-black italic text-indigo-600 tracking-tighter">ZELLE & GO</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Pay {selectedDrop.title}</p>
            </div>
            <div className="bg-slate-50 rounded-[48px] p-8 flex flex-col items-center border border-slate-100 mb-8 shadow-inner">
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Zelle:${selectedDrop.zelleId}`} className="w-48 h-48 mb-6" alt="QR" />
               <p className="font-mono font-black text-indigo-600 bg-white px-4 py-2 rounded-xl text-xs">{selectedDrop.zelleId}</p>
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
