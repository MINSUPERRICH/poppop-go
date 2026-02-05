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
  Instagram, Truck, Store, Zap, CheckCircle2, Ticket
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
  const [searchTerm, setSearchTerm] = useState("");
  
  // Food Truck specific states
  const [menuItemInput, setMenuItemInput] = useState({ name: '', price: '' });
  const [loyaltyUnlocked, setLoyaltyUnlocked] = useState(false);

  const [newDrop, setNewDrop] = useState({
    title: '', 
    locationName: '', 
    zelleId: '', 
    images: [], 
    status: 'live',
    type: 'food-truck', 
    menu: [] // Array of { name, price, soldOut }
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

  // --- 3. Filter Logic ---
  const filteredDrops = drops.filter(drop => {
    const search = searchTerm.toLowerCase();
    return (
      drop.title?.toLowerCase().includes(search) || 
      drop.locationName?.toLowerCase().includes(search) ||
      drop.menu?.some(m => m.name.toLowerCase().includes(search))
    );
  });

  // --- 4. Sharing & Loyalty ---
  const shareToSocial = async (drop, platform) => {
    const shareText = `🚚 FIND US NOW: ${drop.title} is at ${drop.locationName}! Menu updated live on PopPop Go.`;
    const shareUrl = `https://poppopnow.com`;

    try {
      const clipText = `${shareText} ${shareUrl}`;
      await navigator.clipboard.writeText(clipText);
      if (platform === 'instagram') window.location.href = 'instagram://camera';
      if (platform === 'tiktok') window.location.href = 'snssdk1128://';
      
      // Unlock loyalty code locally for the user
      setLoyaltyUnlocked(true);
      alert("Promo text copied! Share it to unlock your 10% discount code.");
    } catch (err) { console.error(err); }
  };

  // --- 5. Actions ---
  const handleAddMenuItem = () => {
    if (!menuItemInput.name) return;
    setNewDrop({ ...newDrop, menu: [...newDrop.menu, { ...menuItemInput, soldOut: false }] });
    setMenuItemInput({ name: '', price: '' });
  };

  const toggleMenuItemStatus = async (dropId, menuIndex) => {
    const drop = drops.find(d => d.id === dropId);
    const updatedMenu = [...drop.menu];
    updatedMenu[menuIndex].soldOut = !updatedMenu[menuIndex].soldOut;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drops', dropId), { menu: updatedMenu });
  };

  const handlePostDrop = async (e) => {
    e.preventDefault();
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'drops'), {
        ...newDrop, merchantId: user.uid, lat: pos.coords.latitude, lng: pos.coords.longitude, createdAt: serverTimestamp(),
      });
      setView('explore');
      setNewDrop({ title: '', locationName: '', zelleId: '', images: [], status: 'live', type: 'food-truck', menu: [] });
    });
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

  // --- 6. Map Component ---
  const MapView = () => {
    const mapInstance = useRef(null);
    useEffect(() => {
      const init = () => {
        if (mapInstance.current || !window.L) return;
        const map = window.L.map('map-element', { zoomControl: false }).setView([40.7128, -74.0060], 13);
        mapInstance.current = map;
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
        filteredDrops.filter(d => d.status === 'live').forEach(drop => {
          if (!drop.lat || !drop.lng) return;
          const marker = window.L.marker([drop.lat, drop.lng]).addTo(map);
          marker.bindPopup(`<b>${drop.title}</b><br><button onclick="window.dispatchEvent(new CustomEvent('viewShop', {detail: '${drop.id}'}))" style="margin-top:5px; background:#4f46e5; color:white; border:none; padding:5px 10px; border-radius:5px;">VIEW MENU</button>`);
        });
      };
      if (!window.L) {
        const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = init; document.head.appendChild(s);
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l);
      } else init();
    }, [filteredDrops]);
    return <div id="map-element" className="h-full w-full"></div>;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans max-w-md mx-auto border-x border-slate-200 shadow-2xl relative overflow-hidden text-slate-900">
      
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md px-6 pt-12 pb-4 sticky top-0 z-30 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-indigo-600 italic">PopPop Go</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
             <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> {filteredDrops.length} Live Targets
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
            <div className="p-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-20">
               <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input 
                    type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Find Trucks, Burgers, Coffee..."
                    className="w-full pl-12 pr-12 py-4 bg-white border border-slate-200 rounded-[24px] text-sm font-medium outline-none focus:ring-4 ring-indigo-500/10 transition-all shadow-sm"
                  />
               </div>
            </div>

            {displayMode === 'list' ? (
              <div className="px-4 space-y-4 pb-32">
                {filteredDrops.map(drop => (
                  <div key={drop.id} onClick={() => { setSelectedDrop(drop); setView('shop-detail'); }} className={`bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100 active:scale-[0.98] transition-all`}>
                    <div className="relative h-64">
                      <img src={drop.images?.[0]} className="w-full h-full object-cover" />
                      <div className="absolute top-4 left-4 flex gap-2">
                        <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg flex items-center gap-1">
                          <Truck className="w-3 h-3" /> {drop.type?.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="p-5 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-lg">{drop.title}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1 font-bold"><MapPin className="w-3 h-3 text-red-500" /> {drop.locationName}</p>
                      </div>
                      <ChevronRight className="text-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : <MapView />}
          </>
        )}

        {view === 'shop-detail' && selectedDrop && (
          <div className="pb-40 bg-white min-h-screen animate-in slide-in-from-right">
             <div className="relative h-80 overflow-x-auto snap-x flex scrollbar-hide">
                {(selectedDrop.images || []).map((img, i) => (<img key={i} src={img} className="w-full h-full object-cover snap-center shrink-0" />))}
                <button onClick={() => setView('explore')} className="absolute top-12 left-6 bg-white/90 p-3 rounded-full shadow-lg z-20"><ChevronLeft /></button>
                <button onClick={() => shareToSocial(selectedDrop, 'native')} className="absolute top-12 right-6 bg-white/90 p-3 rounded-full shadow-lg z-20"><Share2 className="text-indigo-600" /></button>
             </div>
             
             <div className="p-8 -mt-10 bg-white rounded-t-[48px] relative z-10 space-y-6">
                <div className="flex justify-between items-center">
                   <h2 className="text-3xl font-black italic">{selectedDrop.title}</h2>
                   <div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black animate-pulse">LIVE NOW</div>
                </div>

                {/* Loyalty Promo */}
                {!loyaltyUnlocked ? (
                  <button onClick={() => shareToSocial(selectedDrop, 'instagram')} className="w-full bg-gradient-to-r from-pink-500 to-indigo-600 p-4 rounded-3xl text-white flex items-center justify-between shadow-xl shadow-pink-100">
                    <div className="flex items-center gap-3">
                       <Instagram className="w-6 h-6" />
                       <div className="text-left">
                          <p className="text-[10px] font-black uppercase opacity-80">Story Loyalty</p>
                          <p className="font-bold text-sm">Share to Story for 10% OFF</p>
                       </div>
                    </div>
                    <ChevronRight className="opacity-50" />
                  </button>
                ) : (
                  <div className="bg-amber-50 border-2 border-dashed border-amber-200 p-4 rounded-3xl flex flex-col items-center gap-1 animate-in zoom-in">
                     <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Your Discount Code</p>
                     <p className="text-2xl font-black text-amber-900 tracking-tighter">POPSHARE10</p>
                     <p className="text-[9px] text-amber-500 font-bold">Show this to the truck window!</p>
                  </div>
                )}

                {/* Menu List */}
                <div className="space-y-3">
                  <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest flex items-center gap-2"><ShoppingBag className="w-3 h-3" /> Current Menu</h3>
                  {selectedDrop.menu?.map((item, idx) => (
                    <div key={idx} className={`flex justify-between items-center p-4 rounded-2xl border ${item.soldOut ? 'bg-slate-50 border-slate-100 opacity-50' : 'bg-white border-slate-200'}`}>
                       <p className={`font-bold ${item.soldOut ? 'line-through' : ''}`}>{item.name}</p>
                       <div className="flex items-center gap-3">
                         <span className="text-indigo-600 font-black">${item.price}</span>
                         {!item.soldOut && (
                           <button 
                             onClick={() => { setMemoText(`I'd like to order: ${item.name}`); window.scrollTo(0, document.body.scrollHeight); }}
                             className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-3 py-1 rounded-lg uppercase"
                           >
                             Order Ahead
                           </button>
                         )}
                         {item.soldOut && <span className="bg-red-100 text-red-500 text-[8px] font-black px-2 py-1 rounded-md">SOLD OUT</span>}
                       </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                   <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase">Pre-Order / Memo</div>
                   <div className="flex gap-2">
                      <input value={memoText} onChange={e => setMemoText(e.target.value)} placeholder="Message the window..." className="flex-1 p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white font-medium" />
                      <button onClick={async () => {
                         await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'memos'), {
                           text: memoText, merchantId: selectedDrop.merchantId, dropTitle: selectedDrop.title, timestamp: serverTimestamp()
                         });
                         setMemoText(""); alert("Memo sent to truck!");
                      }} className="bg-indigo-600 text-white p-3 rounded-xl"><Send className="w-4 h-4" /></button>
                   </div>
                </div>
                
                <button onClick={() => setShowPayment(true)} className="w-full bg-indigo-600 p-6 rounded-[32px] flex justify-between items-center text-white shadow-xl shadow-indigo-100">
                   <div className="text-left">
                     <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Scan to Pay</p>
                     <p className="font-bold text-lg">{selectedDrop.zelleId}</p>
                   </div>
                   <div className="bg-white/20 p-3 rounded-2xl"><QrCode /></div>
                </button>
             </div>
          </div>
        )}

        {view === 'merchant-dash' && (
          <div className="p-8 space-y-8 pb-40">
            <h2 className="text-3xl font-black italic underline decoration-indigo-200">Merchant Hub</h2>
            <div className="space-y-4">
              <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest flex items-center gap-2"><Bell className="w-4 h-4 text-red-500" /> Customer Queue ({memos.length})</h3>
              {memos.map(memo => (
                <div key={memo.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative group animate-in slide-in-from-left">
                  <p className="text-[10px] font-black text-indigo-500 uppercase mb-1">REQ: {memo.dropTitle}</p>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed">"{memo.text}"</p>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'memos', memo.id))} className="absolute top-4 right-4 text-slate-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-100">
              <h3 className="font-black text-xs uppercase text-slate-400 tracking-widest">Active Truck Inventory</h3>
              {drops.filter(d => d.merchantId === user?.uid).map(myDrop => (
                <div key={myDrop.id} className="bg-white p-5 rounded-[32px] border border-slate-200 space-y-4 shadow-sm">
                  <div className="flex items-center gap-4">
                    <img src={myDrop.images?.[0]} className="w-14 h-14 rounded-2xl object-cover shrink-0" />
                    <div className="flex-1 min-w-0"><p className="font-black text-lg truncate tracking-tighter">{myDrop.title}</p></div>
                    <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drops', myDrop.id))} className="p-3 bg-red-50 text-red-400 rounded-xl"><Trash2 className="w-5 h-5" /></button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {myDrop.menu?.map((item, mIdx) => (
                      <button key={mIdx} onClick={() => toggleMenuItemStatus(myDrop.id, mIdx)} className={`flex justify-between items-center px-4 py-3 rounded-xl border text-xs font-bold transition-all ${item.soldOut ? 'bg-red-50 border-red-100 text-red-500' : 'bg-green-50 border-green-100 text-green-600'}`}>
                        <span>{item.name} (${item.price})</span>
                        <span>{item.soldOut ? 'SOLD OUT' : 'AVAILABLE'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={() => setView('post')} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black shadow-xl uppercase tracking-widest text-xs">+ DROP NEW TARGET</button>
            </div>
          </div>
        )}

        {view === 'post' && (
          <div className="p-8 space-y-6 pb-40 animate-in slide-in-from-bottom">
            <h2 className="text-3xl font-black italic">Go Live</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                 {newDrop.images.map((img, i) => (<div key={i} className="aspect-square rounded-2xl overflow-hidden relative border border-slate-200"><img src={img} className="w-full h-full object-cover" /></div>))}
                 {newDrop.images.length < 5 && (
                   <label className="aspect-square rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer">
                      {isUploading ? <Loader2 className="animate-spin" /> : <Camera />}
                      <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                   </label>
                 )}
              </div>
              <input required value={newDrop.title} onChange={e=>setNewDrop({...newDrop, title:e.target.value})} placeholder="Truck Name" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none" />
              <input required value={newDrop.locationName} onChange={e=>setNewDrop({...newDrop, locationName:e.target.value})} placeholder="Precisely where are you? (Parking Lot B, etc)" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none" />
              <input required value={newDrop.zelleId} onChange={e=>setNewDrop({...newDrop, zelleId:e.target.value})} placeholder="Zelle Phone or Email" className="w-full p-4 rounded-2xl border border-slate-200 font-bold outline-none" />
              
              <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3">
                 <p className="text-[10px] font-black text-slate-400 uppercase">Build Today's Menu</p>
                 <div className="flex gap-2">
                    <input value={menuItemInput.name} onChange={e=>setMenuItemInput({...menuItemInput, name: e.target.value})} placeholder="Item Name" className="flex-1 p-3 rounded-xl border border-slate-100 text-xs font-bold" />
                    <input value={menuItemInput.price} onChange={e=>setMenuItemInput({...menuItemInput, price: e.target.value})} placeholder="$" className="w-16 p-3 rounded-xl border border-slate-100 text-xs font-bold text-center" />
                    <button onClick={handleAddMenuItem} className="bg-indigo-600 text-white px-3 rounded-xl"><Plus className="w-4 h-4" /></button>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {newDrop.menu.map((item, idx) => (
                      <span key={idx} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[9px] font-black flex items-center gap-1">{item.name} ${item.price} <X className="w-2 h-2" onClick={() => setNewDrop({...newDrop, menu: newDrop.menu.filter((_, i) => i !== idx)})} /></span>
                    ))}
                 </div>
              </div>

              <button onClick={handlePostDrop} className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black shadow-xl">PUBLISH TO MAP</button>
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
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onClick={() => setShowPayment(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-t-[50px] p-10 animate-in slide-in-from-bottom">
            <h3 className="text-2xl font-black text-center mb-8 italic tracking-tighter">ZELLE PAY</h3>
            <div className="bg-slate-50 rounded-[48px] p-10 flex flex-col items-center border border-slate-100 mb-8 shadow-inner">
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Zelle:${selectedDrop.zelleId}`} className="w-48 h-48 mb-6 rounded-xl shadow-lg" alt="QR" />
               <p className="font-mono font-black text-indigo-600 text-xs tracking-tighter bg-white px-4 py-2 rounded-xl shadow-sm">{selectedDrop.zelleId}</p>
            </div>
            <button onClick={() => setShowPayment(false)} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black uppercase text-xs">I've Swiped Payment</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-in { animation: fadeIn 0.3s ease-out; }
        .slide-in-from-bottom { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .slide-in-from-right { animation: slideRight 0.3s ease-out; }
        .zoom-in { animation: zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
