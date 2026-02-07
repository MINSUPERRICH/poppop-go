import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, serverTimestamp, doc, deleteDoc
} from 'firebase/firestore';
import { 
  getAuth, onAuthStateChanged, GoogleAuthProvider, 
  signInWithPopup, signOut 
} from 'firebase/auth';
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from 'firebase/storage';
import { 
  MapPin, User, ShoppingBag, QrCode, ChevronLeft, 
  Plus, X, Map as MapIcon, Grid, ChevronRight, 
  Loader2, Trash2, Navigation, Search, Camera, LogIn, Share2, CheckCircle2, Check, HelpCircle, Truck
} from 'lucide-react';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const popApp = initializeApp(firebaseConfig);
const popAuth = getAuth(popApp);
const popDb = getFirestore(popApp);
const popStorage = getStorage(popApp);
const APP_PATH = "poppop-go-live";

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore'); 
  const [displayMode, setDisplayMode] = useState('list'); 
  const [drops, setDrops] = useState([]);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemSearch, setItemSearch] = useState("");

  // Merchant States
  const [isPosting, setIsPosting] = useState(false);
  const [itemImageLoading, setItemImageLoading] = useState(false);
  const [menuItemInput, setMenuItemInput] = useState({ name: '', price: '', image: '' });
  const [newDrop, setNewDrop] = useState({
    title: '', locationName: '', zelleId: '', zelleQR: '', images: [], type: 'static', menu: [] 
  });

  useEffect(() => {
    return onAuthStateChanged(popAuth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    const q = query(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops'));
    return onSnapshot(q, (s) => setDrops(s.docs.map(d => ({id: d.id, ...d.data()}))));
  }, []);

  const handleLogin = async () => {
    try { await signInWithPopup(popAuth, new GoogleAuthProvider()); } catch (e) { alert(e.message); }
  };

  const uploadToFirebase = async (file, path) => {
    const sRef = ref(popStorage, `artifacts/${APP_PATH}/${path}/${Date.now()}_${file.name}`);
    const snap = await uploadBytes(sRef, file);
    return await getDownloadURL(snap.ref);
  };

  const handlePostDrop = async () => {
    if (!user) return;
    if (!newDrop.title || !newDrop.zelleId) return alert("Please fill Store Name and Zelle ID");
    setIsPosting(true);
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      await addDoc(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops'), {
        ...newDrop,
        merchantId: user.uid,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        createdAt: serverTimestamp(),
      });
      setView('explore');
      setNewDrop({ title: '', locationName: '', zelleId: '', zelleQR: '', images: [], type: 'static', menu: [] });
    } catch (e) { alert("Enable GPS and upload a cover photo to go live!"); }
    finally { setIsPosting(false); }
  };

  const MapView = () => {
    const mapRef = useRef(null);
    const layersRef = useRef(null);
    useEffect(() => {
      if (!mapRef.current && window.L) {
        const map = window.L.map('map-el', { zoomControl: false }).setView([40.7128, -74.0060], 13);
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
        mapRef.current = map;
        layersRef.current = window.L.layerGroup().addTo(map);
        navigator.geolocation.getCurrentPosition(p => map.setView([p.coords.latitude, p.coords.longitude], 14));
      }
      if (layersRef.current && window.L) {
        layersRef.current.clearLayers();
        drops.forEach(d => {
          const iconHtml = `<div style="background: ${d.type === 'food-truck' ? '#f59e0b' : '#4f46e5'}; color: white; padding: 8px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-size: 16px;">${d.type === 'food-truck' ? '🚚' : '🛍️'}</div>`;
          const customIcon = window.L.divIcon({ html: iconHtml, className: '', iconSize: [40, 40] });
          const marker = window.L.marker([d.lat, d.lng], { icon: customIcon }).addTo(layersRef.current);
          marker.bindPopup(`<div style="text-align: center; font-family: sans-serif; padding: 5px;"><strong style="font-size: 14px;">${d.title}</strong><br/><button id="pop-${d.id}" style="margin-top: 10px; background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 12px; font-weight: 800; cursor: pointer; width: 100%;">VIEW SHOP</button></div>`, { closeButton: false });
          marker.on('popupopen', () => {
            document.getElementById(`pop-${d.id}`).onclick = () => { setSelectedDrop(d); setView('shop-detail'); };
          });
        });
      }
    }, [drops]);
    return <div id="map-el" className="h-[75vh] w-full rounded-[40px] border-4 border-white shadow-2xl mt-4"></div>;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans max-w-md mx-auto border-x border-slate-200 relative overflow-hidden text-slate-900">
      
      {/* HEADER */}
      <header className="bg-white/95 backdrop-blur-md px-6 pt-12 pb-4 sticky top-0 z-30 border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <h1 className="text-2xl font-black text-indigo-600 italic tracking-tighter cursor-pointer" onClick={() => setView('explore')}>PopPop Go</h1>
           <button onClick={() => setShowFAQ(true)} className="text-slate-300 hover:text-indigo-400 transition-colors"><HelpCircle size={18}/></button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDisplayMode(displayMode === 'list' ? 'map' : 'list')} className="w-10 h-10 rounded-2xl border flex items-center justify-center bg-white shadow-sm">
            {displayMode === 'list' ? <MapIcon size={18}/> : <Grid size={18}/>}
          </button>
          {!user ? <button onClick={handleLogin} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md"><LogIn size={14}/> LOGIN</button> : <button onClick={() => setView('merchant-dash')} className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100"><User size={18} className="text-indigo-600"/></button>}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {view === 'explore' && (
          <div className="p-4 space-y-4 pb-24">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
              <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search for food or shops..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-3xl shadow-sm outline-none font-medium"/>
            </div>
            {displayMode === 'list' ? (
              <div className="space-y-4">
                {drops.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase())).map(d => (
                  <div key={d.id} onClick={() => { setSelectedDrop(d); setView('shop-detail'); }} className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm active:scale-95 transition-all">
                    <img src={d.images[0]} className="h-52 w-full object-cover" alt={d.title} />
                    <div className="p-5 flex justify-between items-center">
                      <div><h3 className="font-bold text-lg tracking-tight">{d.title}</h3><p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><MapPin size={12} className="text-red-500"/> {d.locationName}</p></div>
                      <div className={`p-3 rounded-2xl ${d.type === 'food-truck' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>{d.type === 'food-truck' ? <Truck size={20}/> : <ShoppingBag size={20}/>}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <MapView />}
          </div>
        )}

        {view === 'shop-detail' && selectedDrop && (
          <div className="animate-in slide-in-from-right pb-32">
            <div className="relative h-72"><img src={selectedDrop.images[0]} className="w-full h-full object-cover" alt={selectedDrop.title} /><button onClick={() => setView('explore')} className="absolute top-6 left-6 bg-white p-2 rounded-full shadow-lg"><ChevronLeft /></button></div>
            <div className="p-8 -mt-10 bg-white rounded-t-[48px] relative z-10 space-y-6 shadow-2xl">
              <div className="flex justify-between items-start">
                <div><h2 className="text-3xl font-black tracking-tighter">{selectedDrop.title}</h2><p className="text-slate-400 text-xs font-bold uppercase mt-1 tracking-widest">{selectedDrop.locationName}</p></div>
                <div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black italic">LIVE NOW</div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedDrop.locationName)}`)} className="flex-1 bg-slate-100 py-4 rounded-3xl font-black flex flex-col items-center text-[10px] uppercase tracking-tighter"><Navigation className="mb-1 text-indigo-600" size={20}/> Map</button>
                <button onClick={()=>setShowPayment(true)} className="flex-1 bg-indigo-600 text-white py-4 rounded-3xl font-black flex flex-col items-center text-[10px] uppercase tracking-tighter shadow-lg shadow-indigo-200"><QrCode className="mb-1" size={20}/> Zelle Pay</button>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3"><h3 className="font-black text-xs uppercase text-slate-400 tracking-widest">Store Menu</h3><input placeholder="Search menu..." className="text-xs outline-none text-right font-bold text-indigo-600" onChange={e => setItemSearch(e.target.value)} /></div>
                <div className="grid gap-3">
                  {selectedDrop.menu?.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase())).map((item, idx) => (
                    <div key={idx} onClick={() => setPreviewItem(item)} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl cursor-pointer active:scale-95 transition-all border border-slate-100">
                      <div className="flex items-center gap-3"><div className="w-14 h-14 rounded-xl bg-slate-200 overflow-hidden shadow-sm"><img src={item.image} className="w-full h-full object-cover" alt={item.name} /></div><span className="font-bold text-slate-800">{item.name}</span></div>
                      <span className="font-black text-indigo-600 bg-white px-3 py-1 rounded-lg border border-indigo-50 shadow-sm">${item.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-6 animate-in slide-in-from-bottom pb-40">
            <h2 className="text-3xl font-black italic tracking-tighter">Go Live</h2>
            <div className="space-y-4">
              <div className="flex gap-2 p-1.5 bg-slate-100 rounded-3xl">
                <button onClick={() => setNewDrop({...newDrop, type:'static'})} className={`flex-1 py-3 rounded-2xl text-xs font-black tracking-widest ${newDrop.type === 'static' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>POP-UP SHOP</button>
                <button onClick={() => setNewDrop({...newDrop, type:'food-truck'})} className={`flex-1 py-3 rounded-2xl text-xs font-black tracking-widest ${newDrop.type === 'food-truck' ? 'bg-white shadow text-amber-600' : 'text-slate-400'}`}>FOOD TRUCK</button>
              </div>
              <label className="block w-full h-40 border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center text-slate-400 border-slate-200 bg-white overflow-hidden active:bg-slate-50 transition-colors cursor-pointer">
                {newDrop.images.length > 0 ? <img src={newDrop.images[0]} className="w-full h-full object-cover" alt="preview" /> : <><Camera size={32} className="text-indigo-200" /> <span className="text-[10px] font-black mt-3 uppercase tracking-widest">Main Store Photo</span></>}
                <input type="file" className="hidden" onChange={async (e) => { const url = await uploadToFirebase(e.target.files[0], 'drops'); setNewDrop({...newDrop, images: [url]}); }} />
              </label>
              <input value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title: e.target.value})} placeholder="Store Name" className="w-full p-5 rounded-3xl border border-slate-100 outline-none font-bold shadow-sm" />
              <input value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName: e.target.value})} placeholder="Full Address (e.g. 123 Main St)" className="w-full p-5 rounded-3xl border border-slate-100 outline-none text-sm shadow-sm" />
              
              <div className="bg-indigo-50 p-6 rounded-[32px] space-y-4 border border-indigo-100 shadow-inner">
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Zelle Payment Info</p>
                 <input value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId: e.target.value})} placeholder="Zelle Email or Phone" className="w-full p-4 rounded-2xl border-none outline-none text-sm font-bold shadow-sm" />
                 <label className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-indigo-100 cursor-pointer shadow-sm active:scale-95 transition-transform">
                    <QrCode size={20} className="text-indigo-600"/>
                    <span className="text-[11px] font-black text-indigo-900 flex-1 uppercase tracking-tighter">{newDrop.zelleQR ? "✅ QR Code Ready" : "Upload Bank QR Code"}</span>
                    <input type="file" className="hidden" onChange={async (e) => { const url = await uploadToFirebase(e.target.files[0], 'qrcodes'); setNewDrop({...newDrop, zelleQR: url}); }} />
                 </label>
              </div>

              <div className="p-6 bg-white border border-slate-100 rounded-[32px] space-y-4 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Build Your Menu</p>
                <div className="flex gap-2">
                  <label className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center cursor-pointer border border-slate-100 shrink-0">
                    {itemImageLoading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-600"/> : menuItemInput.image ? <img src={menuItemInput.image} className="w-full h-full object-cover rounded-2xl" alt="item"/> : <Camera size={18} className="text-slate-300"/>}
                    <input type="file" className="hidden" onChange={async (e) => { setItemImageLoading(true); try { const url = await uploadToFirebase(e.target.files[0], 'items'); setMenuItemInput({...menuItemInput, image: url}); } finally { setItemImageLoading(false); } }} />
                  </label>
                  <div className="flex-1 space-y-2">
                    <input value={menuItemInput.name} onChange={e=>setMenuItemInput({...menuItemInput, name: e.target.value})} placeholder="Item Name" className="w-full px-4 py-2 rounded-xl border border-slate-50 text-sm outline-none bg-slate-50 font-bold" />
                    <input value={menuItemInput.price} onChange={e=>setMenuItemInput({...menuItemInput, price: e.target.value})} placeholder="Price $" className="w-full px-4 py-2 rounded-xl border border-slate-50 text-sm outline-none bg-slate-50 font-bold" />
                  </div>
                </div>
                <button onClick={() => { if(menuItemInput.image && menuItemInput.name) { setNewDrop({...newDrop, menu: [...newDrop.menu, menuItemInput]}); setMenuItemInput({name:'', price:'', image:''}); } else { alert("Photo + Name required!"); } }} className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100">Add to Menu</button>
                <div className="flex flex-wrap gap-2 pt-2">
                   {newDrop.menu.map((m, i) => <div key={i} className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2">{m.name} <X size={10} className="cursor-pointer" onClick={()=>setNewDrop({...newDrop, menu: newDrop.menu.filter((_, idx)=>idx!==i)})}/></div>)}
                </div>
              </div>
              <button onClick={handlePostDrop} disabled={isPosting} className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black uppercase tracking-widest flex justify-center shadow-2xl active:scale-95 transition-all">{isPosting ? <Loader2 className="animate-spin"/> : 'Open My Store'}</button>
            </div>
          </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-32">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black italic tracking-tighter">
                {user?.email === "YOUR_ADMIN_EMAIL@gmail.com" ? "Admin Panel" : "My Hub"}
              </h2>
              <button onClick={() => signOut(popAuth)} className="text-red-500 font-black text-[10px] tracking-widest bg-red-50 px-3 py-2 rounded-xl">LOGOUT</button>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {user?.email === "YOUR_ADMIN_EMAIL@gmail.com" ? "All Global Active Spots" : "Your Live Spots"}
              </p>

              {drops.filter(d => 
                user?.email === "YOUR_ADMIN_EMAIL@gmail.com" ? true : d.merchantId === user?.uid
              ).length === 0 && (
                <div className="text-center py-10 bg-slate-50 rounded-3xl border border-dashed text-slate-400 font-bold text-xs uppercase">No active spots</div>
              )}

              {drops.filter(d => 
                user?.email === "YOUR_ADMIN_EMAIL@gmail.com" ? true : d.merchantId === user?.uid
              ).map(myDrop => (
                <div key={myDrop.id} className="bg-white p-6 rounded-[32px] border border-slate-100 flex items-center justify-between shadow-sm animate-in">
                  <div className="flex flex-col">
                    <span className="font-bold text-lg leading-none">{myDrop.title}</span>
                    {user?.email === "YOUR_ADMIN_EMAIL@gmail.com" && (
                      <span className="text-[9px] text-indigo-500 font-bold mt-1 uppercase">Owner: {myDrop.merchantId.slice(0,8)}</span>
                    )}
                  </div>
                  <button 
                    onClick={async () => { 
                      const isAdmin = user?.email === "YOUR_ADMIN_EMAIL@gmail.com";
                      if(confirm(isAdmin ? "ADMIN: Delete this shop permanently?" : "Delete your spot?")) {
                        await deleteDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', myDrop.id)); 
                      }
                    }} 
                    className="p-3 bg-red-50 text-red-500 rounded-2xl active:scale-90 transition-transform"
                  >
                    <Trash2 size={20}/>
                  </button>
                </div>
              ))}
              <button onClick={() => setView('post')} className="w-full py-6 border-2 border-dashed border-indigo-100 bg-indigo-50/30 rounded-[32px] text-indigo-600 font-black text-xs uppercase tracking-widest">+ NEW LOCATION</button>
            </div>
          </div>
        )}
      </main>

      {/* NAVIGATION */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-white/80 backdrop-blur-2xl border border-white/50 shadow-2xl rounded-[38px] py-4 px-10 flex justify-between items-center z-40">
        <button onClick={() => { setView('explore'); setDisplayMode('list'); }} className={view === 'explore' ? 'text-indigo-600' : 'text-slate-300'}><ShoppingBag size={24}/></button>
        <button onClick={() => { if(!user) { handleLogin(); } else { setView('post'); } }} className="bg-indigo-600 text-white p-5 rounded-[28px] shadow-xl shadow-indigo-200 -mt-16 active:scale-90 transition-transform"><Plus size={32}/></button>
        <button onClick={() => setView('merchant-dash')} className={view === 'merchant-dash' ? 'text-indigo-600' : 'text-slate-300'}><User size={24}/></button>
      </nav>

      {/* MODAL: ITEM PREVIEW */}
      {previewItem && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-6 animate-in fade-in duration-300" onClick={() => setPreviewItem(null)}>
          <div className="bg-white rounded-[48px] overflow-hidden max-w-sm w-full shadow-2xl animate-in zoom-in-95" onClick={e=>e.stopPropagation()}>
            <div className="relative">
               <img src={previewItem.image} className="w-full h-80 object-cover" alt="item-preview" />
               <button onClick={()=>setPreviewItem(null)} className="absolute top-6 right-6 bg-white/20 backdrop-blur-md text-white p-2 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-8 text-center bg-white">
              <h3 className="text-2xl font-black mb-2 italic tracking-tighter">{previewItem.name}</h3>
              <p className="text-indigo-600 font-black text-3xl mb-4">${previewItem.price}</p>
              <button onClick={()=>setPreviewItem(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ZELLE SMART PAY & GUIDE */}
      {showPayment && selectedDrop && (
        <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-6 animate-in fade-in" onClick={()=>setShowPayment(false)}>
          <div className="bg-white p-8 rounded-[48px] text-center max-w-sm w-full shadow-2xl animate-in zoom-in-95" onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-xl font-black italic uppercase tracking-tighter mb-6">Zelle Payment</h3>
            <div className="bg-slate-50 p-6 rounded-[32px] mb-4 border-2 border-dashed border-indigo-100 shadow-inner">
              <img src={selectedDrop.zelleQR || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(selectedDrop.zelleId)}`} className="mx-auto rounded-2xl w-full aspect-square object-contain shadow-md" alt="QR" />
              <p className="font-black text-indigo-900 mt-5 select-all text-xl tracking-tight">{selectedDrop.zelleId}</p>
            </div>
            <div className="flex gap-2 mb-6">
                <button onClick={() => { navigator.clipboard.writeText(selectedDrop.zelleId); alert("ID Copied!"); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all"><CheckCircle2 size={14}/> COPY ID</button>
                <button onClick={() => { if(navigator.share) navigator.share({title: selectedDrop.title, text: `Pay ${selectedDrop.title} via Zelle: ${selectedDrop.zelleId}`}); }} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all"><Share2 size={14}/> SHARE</button>
            </div>
            <div className="text-left space-y-4 mb-6 bg-slate-50 p-6 rounded-[24px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">How to Pay</p>
              <div className="flex gap-3 items-center"><span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</span><p className="text-[11px] font-bold text-slate-700">Open your **Bank App** (Chase, BoA, etc.)</p></div>
              <div className="flex gap-3 items-center"><span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</span><p className="text-[11px] font-bold text-slate-700">Select **"Send Money with Zelle®"**</p></div>
              <div className="flex gap-3 items-center"><span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">3</span><p className="text-[11px] font-bold text-slate-700">**Scan** the QR or **Paste** the Zelle ID</p></div>
            </div>
            <button onClick={()=>setShowPayment(false)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest">Back to Store</button>
          </div>
        </div>
      )}

      {/* MODAL: HELP & FAQ */}
      {showFAQ && (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto p-8 animate-in slide-in-from-bottom duration-500">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase">Help & FAQ</h2>
            <button onClick={() => setShowFAQ(false)} className="p-3 bg-slate-100 rounded-full text-slate-900"><X/></button>
          </div>
          
          <div className="space-y-10">
            {/* Visitors Section */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] border-b pb-2">For Visitors</h3>
              <div className="space-y-4">
                <div className="space-y-1"><h4 className="font-black text-lg">1. Is there a fee?</h4><p className="text-sm text-slate-500 font-medium leading-relaxed">No! PopPop Go is completely free for visitors to find local food trucks and shops.</p></div>
                <div className="space-y-1"><h4 className="font-black text-lg">2. How do I pay?</h4><p className="text-sm text-slate-500 font-medium leading-relaxed">We use Zelle® for fast, secure payments. Once you find a store you love, tap "Zelle Pay" to see their QR code or ID. You then complete the payment inside your own trusted banking app.</p></div>
                <div className="space-y-1"><h4 className="font-black text-lg">3. Why bank apps?</h4><p className="text-sm text-slate-500 font-medium leading-relaxed">Safety first! By using your own bank app via Zelle, your financial details stay private. PopPop Go never sees your bank account info.</p></div>
                <div className="space-y-1"><h4 className="font-black text-lg">4. Map Issues?</h4><p className="text-sm text-slate-500 font-medium leading-relaxed">Make sure "Location Services" are enabled in your browser. Refresh the page and tap "Allow" when prompted.</p></div>
              </div>
            </div>

            {/* Merchants Section */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-amber-600 uppercase tracking-[0.2em] border-b pb-2">For Merchants</h3>
              <div className="space-y-4">
                <div className="space-y-1"><h4 className="font-black text-lg">1. Cost to list?</h4><p className="text-sm text-slate-500 font-medium leading-relaxed">Currently, listing your store and menu on PopPop Go is free!</p></div>
                <div className="space-y-1"><h4 className="font-black text-lg">2. Processing fees?</h4><p className="text-sm text-slate-500 font-medium leading-relaxed">No. Because payments happen peer-to-peer via Zelle, you keep 100% of your sales. PopPop Go does not take a commission.</p></div>
                <div className="space-y-1"><h4 className="font-black text-lg">3. Moving Locations?</h4><p className="text-sm text-slate-500 font-medium leading-relaxed">Easy! Just go to your Merchant Hub, delete your current "Drop," and create a new one at your new spot.</p></div>
                <div className="space-y-1"><h4 className="font-black text-lg">4. Menu Photos?</h4><p className="text-sm text-slate-500 font-medium leading-relaxed">You can add one high-quality photo per item to keep the app fast and snappy for customers.</p></div>
              </div>
            </div>
          </div>
          
          <button onClick={() => setShowFAQ(false)} className="w-full mt-12 py-5 bg-black text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl">Return to App</button>
          <div className="h-20"></div>
        </div>
      )}

    </div>
  );
};

export default App;
