import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, onSnapshot, query, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapPin, User, ShoppingBag, QrCode, ChevronLeft, Plus, X, Map as MapIcon, Grid, Navigation, Search, Camera, LogIn, Clock, Calendar, ChevronRight, Loader2, Trash2, CheckCircle2, RefreshCw, Banknote } from 'lucide-react';

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
  // --- 👑 ADMIN CONFIG ---
  const MY_ADMIN_EMAIL = "yooeuchan@gmail.com"; 

  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore'); 
  const [displayMode, setDisplayMode] = useState('list'); 
  const [sortBy, setSortBy] = useState('newest'); 
  const [drops, setDrops] = useState([]);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [itemImageLoading, setItemImageLoading] = useState(false);
  const [menuItemInput, setMenuItemInput] = useState({ name: '', price: '', image: '' });
  const [newDrop, setNewDrop] = useState({
    title: '', locationName: '', zelleId: '', zelleQR: '', images: [], type: 'static', menu: [], closesAt: '', eventDate: new Date().toISOString().split('T')[0]
  });

  const isAdmin = user?.email?.toLowerCase() === MY_ADMIN_EMAIL.toLowerCase();

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
    if (!newDrop.title) return alert("Required: Store Name"); // Zelle ID is now optional!
    setIsPosting(true);
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      await addDoc(collection(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops'), {
        ...newDrop, merchantId: user.uid, lat: pos.coords.latitude, lng: pos.coords.longitude, createdAt: serverTimestamp(),
      });
      setView('explore');
      setNewDrop({ title: '', locationName: '', zelleId: '', zelleQR: '', images: [], type: 'static', menu: [], closesAt: '', eventDate: new Date().toISOString().split('T')[0] });
    } catch (e) { alert("GPS Access Required to Post."); }
    finally { setIsPosting(false); }
  };

  const updateLocation = async (dropId) => {
    if(!confirm("Update the shop pin to your CURRENT location?")) return;
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      const dropRef = doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', dropId);
      await updateDoc(dropRef, { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: serverTimestamp() });
      alert("Pin moved successfully!");
    } catch (e) { alert("GPS Permission Denied."); }
  };

  const FullMapView = () => {
    const mapRef = useRef(null);
    useEffect(() => {
      if (!mapRef.current && window.L) {
        const map = window.L.map('full-map', { zoomControl: false, tap: false }).setView([40.7128, -74.0060], 12);
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
        mapRef.current = map;
        drops.forEach(d => {
          const iconHtml = `<div style="background: ${d.type === 'food-truck' ? '#f59e0b' : '#4f46e5'}; color: white; padding: 10px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.2); font-size: 18px;">${d.type === 'food-truck' ? '🚚' : '🛍️'}</div>`;
          const customIcon = window.L.divIcon({ html: iconHtml, className: '', iconSize: [40, 40] });
          const marker = window.L.marker([d.lat, d.lng], { icon: customIcon }).addTo(map);
          marker.bindPopup(`<div style="text-align: center; font-family: sans-serif; padding: 5px;"><strong>${d.title}</strong><br><button id="btn-${d.id}" style="margin-top: 10px; background: #4f46e5; color: white; border: none; padding: 8px 15px; border-radius: 10px; font-weight: 800; width: 100%;">VIEW</button></div>`, { closeButton: false });
          marker.on('popupopen', () => { document.getElementById(`btn-${d.id}`).onclick = () => { setSelectedDrop(d); setView('shop-detail'); }; });
        });
      }
    }, [drops]);
    return <div id="full-map" className="absolute inset-0 z-0"></div>;
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans max-w-md mx-auto relative overflow-hidden text-slate-900 border-x border-slate-100 shadow-2xl">
      
      <header className="px-6 pt-10 pb-4 flex justify-between items-center bg-white/90 backdrop-blur-md z-50 border-b border-slate-50">
        <div>
           <h1 className="text-2xl font-black text-indigo-600 italic tracking-tighter cursor-pointer" onClick={() => setView('explore')}>PopPop Go</h1>
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Neighborhood Marketplace</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
          <button onClick={() => setDisplayMode('list')} className={`p-2.5 rounded-xl transition-all ${displayMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><Grid size={20}/></button>
          <button onClick={() => setDisplayMode('map')} className={`p-2.5 rounded-xl transition-all ${displayMode === 'map' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><MapIcon size={20}/></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative bg-slate-50">
        {displayMode === 'map' && view === 'explore' ? (
            <FullMapView />
        ) : view === 'explore' ? (
          <div className="p-5 space-y-6 pb-40 animate-in fade-in duration-500">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none font-bold text-sm"/>
            </div>

            <div className="grid gap-6">
                {drops.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase()) || d.locationName.toLowerCase().includes(searchTerm.toLowerCase()))
                .sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds)
                .map(d => {
                  const dateStr = d.eventDate ? new Date(d.eventDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : "Today";
                  return (
                    <div key={d.id} onClick={() => { setSelectedDrop(d); setView('shop-detail'); }} className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm active:scale-95 transition-all group">
                      <div className="relative h-64 overflow-hidden bg-slate-100">
                          {d.images?.[0] ? <img src={d.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-slate-300 font-black italic uppercase tracking-widest">No Image</div>}
                          <div className="absolute top-4 left-4 flex gap-2">
                              <span className="bg-white/90 backdrop-blur px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm flex items-center gap-1.5">{d.type === 'food-truck' ? <Truck size={10}/> : <ShoppingBag size={10}/>} {d.type === 'food-truck' ? 'Truck' : 'Shop'}</span>
                              <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase">{dateStr}</span>
                              {!d.zelleId && <span className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1"><Banknote size={10}/> Cash Only</span>}
                          </div>
                      </div>
                      <div className="p-6 flex justify-between items-center">
                        <div className="space-y-1">
                          <h3 className="font-black text-xl tracking-tight text-slate-800">{d.title}</h3>
                          <p className="text-xs text-slate-400 flex items-center gap-1 leading-none"><MapPin size={12} className="text-red-500"/> {d.locationName}</p>
                        </div>
                        <div className="text-indigo-600 bg-indigo-50 p-3 rounded-2xl"><ChevronRight size={20}/></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : null}

        {view === 'shop-detail' && selectedDrop && (
            <div className="animate-in slide-in-from-right h-full bg-white z-[60] relative overflow-y-auto pb-32">
                <div className="relative h-80 bg-slate-100">
                    <img src={selectedDrop.images?.[0]} className="w-full h-full object-cover" />
                    <button onClick={() => setView('explore')} className="absolute top-6 left-6 bg-white p-3 rounded-2xl shadow-xl"><ChevronLeft/></button>
                </div>
                <div className="p-8 -mt-10 bg-white rounded-t-[40px] relative space-y-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-4xl font-black tracking-tighter">{selectedDrop.title}</h2>
                            <p className="text-slate-400 text-xs font-black uppercase mt-1 leading-none">{selectedDrop.locationName}</p>
                        </div>
                        <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">Live</span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedDrop.locationName)}`)} className="flex-1 bg-slate-900 text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl"><Navigation size={18}/> Navigation</button>
                        
                        {/* ONLY SHOW ZELLE BUTTON IF ID EXISTS */}
                        {selectedDrop.zelleId ? (
                            <button onClick={()=>setShowPayment(true)} className="flex-1 bg-indigo-600 text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-100"><QrCode size={18}/> Pay Now</button>
                        ) : (
                            <div className="flex-1 bg-emerald-50 text-emerald-600 py-5 rounded-[24px] font-black text-[10px] uppercase flex items-center justify-center gap-2 border border-emerald-100"><Banknote size={18}/> Cash Only</div>
                        )}
                    </div>
                    <div className="space-y-4 pt-4">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest border-b pb-2">Store Menu</p>
                        {selectedDrop.menu?.map((item, i) => (
                            <div key={i} onClick={() => setPreviewItem(item)} className="flex items-center justify-between p-4 bg-slate-50 rounded-[24px] border border-slate-100 cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <img src={item.image} className="w-16 h-16 rounded-xl object-cover" />
                                    <span className="font-black text-slate-700">{item.name}</span>
                                </div>
                                <span className="font-black text-indigo-600 text-lg">$ {item.price}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-8 animate-in slide-in-from-bottom pb-40">
            <h2 className="text-4xl font-black italic tracking-tighter">Go Live</h2>
            <div className="space-y-6">
              <input value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title: e.target.value})} placeholder="Store Name *" className="w-full p-5 rounded-2xl border border-slate-200 bg-white font-black outline-none shadow-sm" />
              <div className="bg-indigo-50/50 p-6 rounded-[32px] border border-indigo-100/50 space-y-3">
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Digital Payment (Optional)</p>
                 <input value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId: e.target.value})} placeholder="Zelle Email or Phone" className="w-full p-4 rounded-xl border border-white bg-white font-bold outline-none text-sm shadow-sm" />
                 <label className="flex items-center gap-4 p-4 bg-white/50 rounded-xl border border-white cursor-pointer active:scale-95 transition-all">
                    <QrCode size={18} className="text-indigo-400"/>
                    <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">{newDrop.zelleQR ? "✓ QR Uploaded" : "Upload Zelle QR (Optional)"}</span>
                    <input type="file" className="hidden" onChange={async (e) => { const url = await uploadToFirebase(e.target.files[0], 'qrcodes'); setNewDrop({...newDrop, zelleQR: url}); }} />
                 </label>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location Details</p>
                <input value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName: e.target.value})} placeholder="Address or Street Corner" className="w-full p-5 rounded-2xl border border-slate-200 bg-white font-bold text-sm outline-none" />
                <div className="flex gap-2">
                    <input type="date" value={newDrop.eventDate} onChange={e=>setNewDrop({...newDrop, eventDate: e.target.value})} className="flex-1 p-5 rounded-2xl border border-slate-200 font-bold outline-none" />
                    <input value={newDrop.closesAt} onChange={e=>setNewDrop({...newDrop, closesAt: e.target.value})} placeholder="Closing time" className="w-32 p-5 rounded-2xl border border-slate-200 font-bold outline-none" />
                </div>
              </div>
              <label className="block w-full h-56 border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center text-slate-400 border-slate-200 bg-white overflow-hidden cursor-pointer">
                {newDrop.images.length > 0 ? <img src={newDrop.images[0]} className="w-full h-full object-cover" /> : <><Camera size={40} className="text-slate-200" /><span className="text-[10px] font-black mt-4 uppercase tracking-widest">Main Shop Photo</span></>}
                <input type="file" className="hidden" onChange={async (e) => { const url = await uploadToFirebase(e.target.files[0], 'drops'); setNewDrop({...newDrop, images: [url]}); }} />
              </label>

              <div className="p-6 bg-slate-900 rounded-[32px] space-y-4 shadow-2xl">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Add Menu Items</p>
                <div className="flex gap-3">
                  <label className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center cursor-pointer shrink-0 overflow-hidden">
                    {itemImageLoading ? <Loader2 className="animate-spin text-white"/> : menuItemInput.image ? <img src={menuItemInput.image} className="w-full h-full object-cover" /> : <Camera size={20} className="text-white/20"/>}
                    <input type="file" className="hidden" onChange={async (e) => { setItemImageLoading(true); try { const url = await uploadToFirebase(e.target.files[0], 'items'); setMenuItemInput({...menuItemInput, image: url}); } finally { setItemImageLoading(false); } }} />
                  </label>
                  <div className="flex-1 space-y-2">
                    <input value={menuItemInput.name} onChange={e=>setMenuItemInput({...menuItemInput, name: e.target.value})} placeholder="Item Name" className="w-full px-4 py-2 bg-white/5 rounded-lg text-white font-bold outline-none" />
                    <input value={menuItemInput.price} onChange={e=>setMenuItemInput({...menuItemInput, price: e.target.value})} placeholder="$ Price" className="w-full px-4 py-2 bg-white/5 rounded-lg text-white font-bold outline-none" />
                  </div>
                </div>
                <button onClick={() => { if(menuItemInput.image && menuItemInput.name) { setNewDrop({...newDrop, menu: [...newDrop.menu, menuItemInput]}); setMenuItemInput({name:'', price:'', image:''}); } }} className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-[10px] uppercase">Add to Menu</button>
                <div className="flex flex-wrap gap-2">{newDrop.menu.map((m, i) => <div key={i} className="bg-white/10 text-white px-3 py-1.5 rounded-lg text-[9px] font-black flex items-center gap-2">{m.name} <X size={12} className="cursor-pointer" onClick={()=>setNewDrop({...newDrop, menu: newDrop.menu.filter((_, idx)=>idx!==i)})}/></div>)}</div>
              </div>

              <button onClick={handlePostDrop} disabled={isPosting} className="w-full bg-indigo-600 text-white py-6 rounded-[32px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all">{isPosting ? <Loader2 className="animate-spin mx-auto"/> : 'Open My Store'}</button>
            </div>
          </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-32">
            <div className="flex justify-between items-center border-b pb-4">
              <div><h2 className="text-3xl font-black italic tracking-tighter">{isAdmin ? "Admin" : "My Hub"}</h2><p className="text-[9px] font-black text-slate-400 uppercase">{user?.email}</p></div>
              <button onClick={() => signOut(popAuth)} className="p-3 bg-red-50 text-red-500 rounded-2xl"><LogIn size={20}/></button>
            </div>
            <div className="space-y-4">
              {drops.filter(d => isAdmin ? true : d.merchantId === user?.uid).map(myDrop => (
                <div key={myDrop.id} className="bg-white p-5 rounded-[28px] border border-slate-100 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img src={myDrop.images?.[0]} className="w-14 h-14 rounded-xl object-cover" />
                        <div><span className="font-black text-lg block leading-none">{myDrop.title}</span><span className="text-[10px] text-slate-400 font-bold uppercase">{myDrop.locationName}</span></div>
                    </div>
                    <button onClick={async () => { if(confirm("Delete Listing?")) await deleteDoc(doc(popDb, 'artifacts', APP_PATH, 'public', 'data', 'drops', myDrop.id)); }} className="p-3 bg-red-50 text-red-500 rounded-2xl"><Trash2 size={20}/></button>
                  </div>
                  <button onClick={() => updateLocation(myDrop.id)} className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 border border-indigo-100 active:bg-indigo-600 active:text-white transition-all"><RefreshCw size={14}/> I am currently here (Update Pin)</button>
                </div>
              ))}
              <button onClick={() => setView('post')} className="w-full py-6 border-2 border-dashed border-indigo-100 bg-indigo-50/20 rounded-[32px] text-indigo-600 font-black text-xs uppercase tracking-widest">+ NEW LISTING</button>
            </div>
          </div>
        )}
      </main>

      {/* FLOATING NAV */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900/90 backdrop-blur-2xl rounded-[35px] py-4 px-10 flex justify-between items-center z-[100] shadow-2xl border border-white/10">
        <button onClick={() => { setView('explore'); setDisplayMode('list'); }} className={view === 'explore' ? 'text-white' : 'text-white/30'}><Grid size={24}/></button>
        <button onClick={() => { if(!user) handleLogin(); else setView('post'); }} className="bg-indigo-600 text-white p-6 rounded-[30px] shadow-2xl shadow-indigo-500/40 -mt-16 active:scale-90 transition-transform"><Plus size={32}/></button>
        <button onClick={() => setView('merchant-dash')} className={view === 'merchant-dash' ? 'text-white' : 'text-white/30'}><User size={24}/></button>
      </nav>

      {/* MODAL: ZELLE PAY */}
      {showPayment && selectedDrop && (
        <div className="fixed inset-0 z-[150] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6" onClick={()=>setShowPayment(false)}>
          <div className="bg-white p-10 rounded-[40px] text-center max-w-sm w-full shadow-2xl" onClick={(e)=>e.stopPropagation()}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Secure Zelle Payment</p>
            <div className="bg-slate-50 p-8 rounded-[32px] mb-8 border border-slate-100 shadow-inner">
              <img src={selectedDrop.zelleQR || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(selectedDrop.zelleId)}`} className="mx-auto rounded-2xl w-full aspect-square object-contain shadow-md mb-6" alt="QR" />
              <p className="font-black text-slate-900 select-all text-2xl tracking-tighter">{selectedDrop.zelleId}</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(selectedDrop.zelleId); alert("ID Copied!"); }} className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 mb-4 flex items-center justify-center gap-3"><CheckCircle2 size={18}/> Copy Zelle ID</button>
            <button onClick={()=>setShowPayment(false)} className="w-full py-5 bg-slate-100 text-slate-500 rounded-[24px] font-black text-xs uppercase tracking-widest">Close</button>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW */}
      {previewItem && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-6 animate-in fade-in" onClick={() => setPreviewItem(null)}>
          <div className="bg-white rounded-[40px] overflow-hidden max-w-sm w-full animate-in zoom-in-95" onClick={e=>e.stopPropagation()}>
            <img src={previewItem.image} className="w-full h-96 object-cover" />
            <div className="p-10 text-center bg-white">
              <h3 className="text-3xl font-black mb-2 uppercase tracking-tighter">{previewItem.name}</h3>
              <p className="text-indigo-600 font-black text-4xl mb-8">$ {previewItem.price}</p>
              <button onClick={()=>setPreviewItem(null)} className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-widest">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
