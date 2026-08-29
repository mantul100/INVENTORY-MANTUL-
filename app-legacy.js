// =====================================================================
// PART B - JAVASCRIPT LENGKAP (TANPA RINGKASAN)
// =====================================================================

// GANTI DENGAN URL WEB APP ANDA
var CLOUD_URL = "https://script.google.com/macros/s/AKfycbygMaoUAW1xuXMhNICDUC9YMcLG3oHigdQX5pGtdBpYiLAAyTyv6D48HJv09cskjmOj7w/exec";

var currentSortMode='az', isSyncing=false, currentPeriod='today', currentUserRole='admin', cart=[], lastReceiptOrder=null, heldOrdersCache=[], splitBills=null, splitCurrentIndex=0, splitCustomerName='';
var appSettings = { taxRate:0, serviceChargeRate:0, showSlogan:true, showAddress:true, showWA:true, showFooter:true, showDuplicate:true, sloganText:'"Kualitas Restoran Bintang Lima, Kini Hadir di Meja Makan Anda"', addressText:'📍 Jl. Contoh No. 123, Kota', waText:'📱 WA: 0881-0255-32438', footerText:'Terima kasih telah berbelanja di MANTUL KITCHEN! 🙏', themes:{}, visibility:{} };
var isMigrated = false;

// ============================================================
// FALLBACK NAMA PRODUK (HARDCODED + M-010 DITAMBAHKAN)
// ============================================================
var FALLBACK_PRODUCT_NAMES = {
    "M-001": "Dimsum Premium",
    "M-002": "Gyoza Premium",
    "M-003": "Dimsum Jumbo",
    "M-004": "Gyoza Jumbo",
    "M-005": "Wonton Udang Premium",
    "M-006": "Lumpia Kulit Tahu Ayam",
    "M-007": "Lumpia Kulit Tahu Udang",
    "M-008": "Steam Ceker Lada Hitam",
    "M-009": "Bakpao Karakter Premium",
    "M-010": "Dimsum Goreng Lumer"
};

var DEFAULT_PRODUCTS = {
    "Dimsum Premium":{cogs:2200,variants:[{label:"Pack isi 5 (Rp17.500)",pcsPerPack:5,pricePerPack:17500},{label:"Pack isi 10 (Rp35.000)",pcsPerPack:10,pricePerPack:35000}]},
    "Gyoza Premium":{cogs:2200,variants:[{label:"Pack isi 5 (Rp17.500)",pcsPerPack:5,pricePerPack:17500},{label:"Pack isi 10 (Rp33.000)",pcsPerPack:10,pricePerPack:33000},{label:"Pack isi 20 (Rp65.000)",pcsPerPack:20,pricePerPack:65000}]},
    "Dimsum Jumbo":{cogs:2700,variants:[{label:"Pack isi 16 (Rp60.000)",pcsPerPack:16,pricePerPack:60000}]},
    "Gyoza Jumbo":{cogs:2700,variants:[{label:"Pcs (Rp3.750)",pcsPerPack:1,pricePerPack:3750}]},
    "Wonton Udang Premium":{cogs:3500,variants:[{label:"Pack isi 5 (Rp25.000)",pcsPerPack:5,pricePerPack:25000},{label:"Pack isi 10 (Rp50.000)",pcsPerPack:10,pricePerPack:50000}]},
    "Lumpia Kulit Tahu Ayam":{cogs:3600,variants:[{label:"Pack isi 5 (Rp25.000)",pcsPerPack:5,pricePerPack:25000}]},
    "Lumpia Kulit Tahu Udang":{cogs:4000,variants:[{label:"Pack isi 5 (Rp25.000)",pcsPerPack:5,pricePerPack:25000}]},
    "Steam Ceker Lada Hitam":{cogs:9000,variants:[{label:"Pack",pcsPerPack:1,pricePerPack:15000}]},
    "Bakpao Karakter Premium":{cogs:14000,variants:[{label:"Pack",pcsPerPack:1,pricePerPack:25000}]},
    "Dimsum Goreng Lumer":{cogs:20000,variants:[{label:"Pack isi 3 (Rp25.000)",pcsPerPack:3,pricePerPack:25000}]}
};

// ============================================================
// VALIDASI PRODUCT CATALOG (MEMPERBAIKI DROPDOWN VARIAN)
// ============================================================
function validateAndFixProductCatalog(catalog) {
    if (!catalog || typeof catalog !== 'object') return catalog;
    var fixed = {};
    for (var sku in catalog) {
        var item = catalog[sku];
        if (!item || typeof item !== 'object') {
            fixed[sku] = { sku: sku, name: FALLBACK_PRODUCT_NAMES[sku] || sku, cogs: 0, variants: [] };
            continue;
        }
        var name = item.name || item.productName || '';
        if (!name || name === sku) name = FALLBACK_PRODUCT_NAMES[sku] || sku;
        
        var variants = Array.isArray(item.variants) ? item.variants : [];
        // RECOVERY: Jika varian kosong, tarik dari default master data
        if (variants.length === 0 && DEFAULT_PRODUCTS[name]) {
            variants = DEFAULT_PRODUCTS[name].variants;
        }
        
        fixed[sku] = {
            sku: sku,
            name: name,
            cogs: item.cogs || (DEFAULT_PRODUCTS[name] ? DEFAULT_PRODUCTS[name].cogs : 0),
            variants: variants
        };
    }
    return fixed;
}

function fixProductCatalogBeforeSave() {
    if (!productCatalog || Object.keys(productCatalog).length === 0) return;
    productCatalog = validateAndFixProductCatalog(productCatalog);
    saveProductCatalog();
}

// ============================================================
// FUNGSI UTILITY
// ============================================================
function generateFormattedDate(){ var n=new Date(); return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0')+' '+String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0'); }
function parseDate(s) {
    if (!s) return new Date(0);
    var str = s.toString().trim();
    
    // 1. Coba format standar (YYYY-MM-DD HH:mm:ss)
    var d = new Date(str);
    if (!isNaN(d)) return d;
    var d2 = new Date(str.replace(' ', 'T'));
    if (!isNaN(d2)) return d2;

    // 2. Coba terjemahkan format Indonesia (Contoh: "18 Juli 2026 pukul 19.15")
    var idMonths = {
        'januari':0, 'februari':1, 'maret':2, 'april':3, 'mei':4, 'juni':5,
        'juli':6, 'agustus':7, 'september':8, 'oktober':9, 'november':10, 'desember':11,
        'jan':0, 'feb':1, 'mar':2, 'apr':3, 'jun':5, 'jul':6, 'agu':7, 'sep':8, 'okt':9, 'nov':10, 'des':11
    };
    
    // Deteksi pola tanggal teks Indonesia
    var matchId = str.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})(?:\s+(?:pukul\s+)?(\d{1,2})[\.\:](\d{1,2})(?:[\.\:](\d{1,2}))?)?/);
    if (matchId) {
        var date = parseInt(matchId[1]);
        var month = idMonths[matchId[2]];
        var year = parseInt(matchId[3]);
        var hour = matchId[4] ? parseInt(matchId[4]) : 0;
        var minute = matchId[5] ? parseInt(matchId[5]) : 0;
        var second = matchId[6] ? parseInt(matchId[6]) : 0;
        if (month !== undefined) {
            return new Date(year, month, date, hour, minute, second);
        }
    }

    // 3. Coba format DD/MM/YYYY (Contoh: 18/07/2026)
    var p = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2})[\.\:](\d{1,2}))?/);
    if (p) {
        var h = p[4] ? parseInt(p[4]) : 0;
        var m = p[5] ? parseInt(p[5]) : 0;
        return new Date(p[3], p[2]-1, p[1], h, m, 0);
    }

    return new Date(str); // Fallback terakhir
}
function formatDisplayDate(s){ var d=parseDate(s); if(isNaN(d))return s; return d.toLocaleDateString('id-ID',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
function formatRupiah(n){ return "Rp "+Math.round(n).toLocaleString('id-ID'); }
function formatNumber(n){ return Math.round(n).toLocaleString('id-ID'); }
function generateSKU(index){ return 'M-'+String(index+1).padStart(3,'0'); }

function playSyncSound(success) {
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        if (success) {
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.value = 0.2;
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
            setTimeout(function() {
                var osc2 = ctx.createOscillator();
                var gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.frequency.value = 1100;
                osc2.type = 'sine';
                gain2.gain.value = 0.15;
                osc2.start();
                osc2.stop(ctx.currentTime + 0.15);
                setTimeout(function(){ ctx.close(); }, 300);
            }, 200);
        } else {
            osc.frequency.value = 400;
            osc.type = 'sawtooth';
            gain.gain.value = 0.15;
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
            setTimeout(function(){ ctx.close(); }, 500);
        }
    } catch(e) { console.log('Audio error'); }
}

// ============================================================
// LOGIN & ROLE
// ============================================================
function jagoModalClose(){var m=document.getElementById('jagoModal');if(m)m.classList.remove('open');}
function jagoPrompt(title,message,value,type){return new Promise(function(resolve){var m=document.getElementById('jagoModal'),t=document.getElementById('jagoModalTitle'),msg=document.getElementById('jagoModalMessage'),inp=document.getElementById('jagoModalInput'),ok=document.getElementById('jagoModalOk'),cancel=document.getElementById('jagoModalCancel');t.textContent=title;msg.textContent=message;inp.style.display='block';inp.type=type||'text';inp.value=value==null?'':value;ok.textContent='Simpan';cancel.style.display='block';m.classList.add('open');setTimeout(function(){inp.focus();inp.select();},80);function done(v){jagoModalClose();ok.onclick=null;cancel.onclick=null;inp.onkeydown=null;resolve(v);}ok.onclick=function(){done(inp.value);};cancel.onclick=function(){done(null);};inp.onkeydown=function(e){if(e.key==='Enter')done(inp.value);if(e.key==='Escape')done(null);};});}
function jagoConfirm(title,message){return new Promise(function(resolve){var m=document.getElementById('jagoModal'),t=document.getElementById('jagoModalTitle'),msg=document.getElementById('jagoModalMessage'),inp=document.getElementById('jagoModalInput'),ok=document.getElementById('jagoModalOk'),cancel=document.getElementById('jagoModalCancel');t.textContent=title;msg.textContent=message;inp.style.display='none';ok.textContent='Ya, Lanjutkan';cancel.style.display='block';m.classList.add('open');function done(v){jagoModalClose();ok.onclick=null;cancel.onclick=null;resolve(v);}ok.onclick=function(){done(true);};cancel.onclick=function(){done(false);};});}
function showToast(message,isError,tone){var old=document.querySelector('.jago-toast');if(old)old.remove();var el=document.createElement('div');el.className='jago-toast'+(isError?' error':'')+(tone?' '+tone:'');el.textContent=String(message||'');document.body.appendChild(el);if(tone==='loading')el._persistent=true;else setTimeout(function(){if(el.parentNode)el.remove();},3600);}
window.alert=function(message){showToast(message,/❌|⚠️|gagal|ditolak|salah/i.test(String(message||'')));};
function showRegisterView(){document.getElementById('accountLoginView').style.display='none';document.getElementById('accountRecoveryView').style.display='none';document.getElementById('legacyAccessView').style.display='none';document.getElementById('userPinLoginView').style.display='none';document.getElementById('accountRegisterView').style.display='block'}
function showRecoveryView(){document.getElementById('accountLoginView').style.display='none';document.getElementById('accountRegisterView').style.display='none';document.getElementById('legacyAccessView').style.display='none';document.getElementById('userPinLoginView').style.display='none';document.getElementById('accountRecoveryView').style.display='block'}
function showLoginView(){document.getElementById('accountRegisterView').style.display='none';document.getElementById('legacyAccessView').style.display='none';document.getElementById('accountRecoveryView').style.display='none';document.getElementById('userPinLoginView').style.display='none';document.getElementById('accountLoginView').style.display='block'}
function showLegacyView(){document.getElementById('accountLoginView').style.display='none';document.getElementById('accountRegisterView').style.display='none';document.getElementById('accountRecoveryView').style.display='none';document.getElementById('userPinLoginView').style.display='none';document.getElementById('legacyAccessView').style.display='block'}
function showUserPinLoginView(){document.getElementById('accountLoginView').style.display='none';document.getElementById('accountRegisterView').style.display='none';document.getElementById('legacyAccessView').style.display='none';document.getElementById('accountRecoveryView').style.display='none';document.getElementById('userPinLoginView').style.display='block'}
function applyLegacySession(){currentUserRole='admin';var ctx={tenantId:'MANTUL-KITCHEN',branchId:'CABANG-UTAMA',tenantName:'MANTUL KITCHEN',userId:'legacy-admin',role:'admin',sessionToken:''};localStorage.setItem('mantulAdminTenantContext',JSON.stringify(ctx));var badge=document.getElementById('userBadge');if(badge)badge.innerText='👤 Admin Legacy · MANTUL-KITCHEN';document.getElementById('pinOverlay').style.display='none';applyRoleUI();loadFromCloud();}
function loginLegacyAccess(){var pin=(document.getElementById('legacyAdminPin')||{}).value;if(pin!=='1234'){document.getElementById('legacyError').textContent='❌ PIN Admin legacy salah';return}applyLegacySession();alert('✅ Akses data original berhasil');}
async function bootstrapExistingOwner(){var pin=(document.getElementById('legacyAdminPin')||{}).value,username=(document.getElementById('legacyOwnerUsername')||{}).value.trim(),password=(document.getElementById('legacyOwnerPassword')||{}).value,name=(document.getElementById('legacyOwnerName')||{}).value.trim();if(pin!=='1234'){document.getElementById('legacyError').textContent='❌ Isi PIN Admin legacy yang benar';return}if(!username||password.length<6){document.getElementById('legacyError').textContent='❌ Username wajib dan password minimal 6 karakter';return}try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'BOOTSTRAP_OWNER',registration:{legacyPin:pin,username:username,password:password,ownerName:name,email:(document.getElementById('legacyOwnerEmail')||{}).value.trim()}})});var data=await r.json();if(data.status!=='success')throw new Error(data.message||'Gagal membuat Owner');applyAccountSession(data.result);alert('✅ Akun Owner berhasil dibuat untuk data original');}catch(e){document.getElementById('legacyError').textContent='❌ '+e.message}}
function applyAccountSession(result){var ident=result.identity||{};currentUserRole=(ident.role||'kasir').toLowerCase();var ctx={tenantId:ident.tenantId,branchId:ident.branchId,tenantName:ident.tenantName||ident.tenantId,userId:ident.userId,name:ident.name||ident.userId,role:currentUserRole,sessionToken:result.sessionToken||''};localStorage.setItem('mantulAdminTenantContext',JSON.stringify(ctx));var badge=document.getElementById('userBadge');if(badge)badge.innerText='👤 '+(ident.name||ident.userId||currentUserRole)+' · '+currentUserRole.toUpperCase();var overlay=document.getElementById('pinOverlay');if(overlay)overlay.style.display='none';applyRoleUI();loadAdminTenantContext();loadFromCloud();refreshShiftStatus();loadHeldOrders();if(result.authMode==='pin'||currentUserRole!=='admin')startIdleLock();}
var authBusy=false;function setAuthLoading(active,message){authBusy=!!active;var ids=['accountLoginView','userPinLoginView'];ids.forEach(function(id){var box=document.getElementById(id);if(box)box.querySelectorAll('button').forEach(function(btn){btn.disabled=!!active;btn.style.opacity=active?'.65':'';btn.style.cursor=active?'wait':'';});});if(active)showToast(message||'Memproses login, mohon tunggu…',false,'loading');}async function loginAccount(){if(authBusy)return;var username=(document.getElementById('accountUsername')||{}).value.trim();var password=(document.getElementById('accountPassword')||{}).value;if(!username||!password){var e=document.getElementById('pinError');if(e)e.textContent='Username dan password wajib diisi';return}setAuthLoading(true,'Memverifikasi akun, mohon tunggu…');try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'LOGIN_ACCOUNT',login:{username:username,password:password}})});var data=await r.json();if(data.status!=='success')throw new Error(data.message||'Login gagal');applyAccountSession(data.result);showToast('Login berhasil. Memuat workspace…',false);}catch(e){var err=document.getElementById('pinError');if(err)err.textContent='❌ '+e.message;showToast('Login gagal. '+e.message,true);}finally{setAuthLoading(false);}}
async function loginPinUser(){if(authBusy)return;var userId=(document.getElementById('pinUserId')||{}).value.trim();var pin=(document.getElementById('pinUserPin')||{}).value;if(!userId||!pin){var e=document.getElementById('userPinError');if(e)e.textContent='User ID dan PIN wajib diisi';return}setAuthLoading(true,'Memverifikasi PIN operasional, mohon tunggu…');try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'LOGIN_PIN_USER',login:{userId:userId,pin:pin}})});var data=await r.json();if(data.status!=='success')throw new Error(data.message||'Akses PIN gagal');data.result.authMode='pin';applyAccountSession(data.result);showToast('Akses berhasil. Memuat workspace…',false);}catch(e){var err=document.getElementById('userPinError');if(err)err.textContent='❌ '+e.message;showToast('Akses PIN gagal. '+e.message,true);}finally{setAuthLoading(false);}}
async function registerTenant(){var reg={username:(document.getElementById('registerUsername')||{}).value.trim(),password:(document.getElementById('registerPassword')||{}).value,ownerName:(document.getElementById('registerOwnerName')||{}).value.trim(),tenantId:(document.getElementById('registerTenantId')||{}).value.trim(),branchId:(document.getElementById('registerBranchId')||{}).value.trim(),tenantName:(document.getElementById('registerTenantName')||{}).value.trim(),pin:(document.getElementById('registerOwnerPin')||{}).value};if(!reg.username||!reg.password||!reg.tenantId||!reg.tenantName){var e=document.getElementById('registerError');if(e)e.textContent='Username, password, Tenant ID, dan nama tenant wajib diisi';return}try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'REGISTER_TENANT',registration:Object.assign(reg,{email:(document.getElementById('registerEmail')||{}).value.trim()})})});var data=await r.json();if(data.status!=='success')throw new Error(data.message||'Pendaftaran gagal');applyAccountSession(data.result);alert('✅ Tenant dan akun Owner berhasil dibuat');}catch(e){var err=document.getElementById('registerError');if(err)err.textContent='❌ '+e.message;}}
function togglePassword(inputId,button){var input=document.getElementById(inputId);if(!input)return;var visible=input.type==='text';input.type=visible?'password':'text';if(button){button.textContent=visible?'◉':'◉';button.setAttribute('aria-label',visible?'Tampilkan password':'Sembunyikan password');}}
async function recoveryRequest(action,payload){var email=String((payload||{}).email||'').trim();if(!email){var empty=document.getElementById('recoveryError');if(empty)empty.textContent='❌ Email pendaftaran wajib diisi';return}try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:action,recovery:payload})});var data=await r.json();if(data.status==='error')throw new Error(data.message||'Permintaan gagal');var el=document.getElementById('recoveryError');if(el)el.textContent='✅ '+(data.result&&data.result.message||'Permintaan diproses. Periksa email Anda.');}catch(e){var el=document.getElementById('recoveryError');if(el)el.textContent='❌ '+e.message}}
function requestUsernameRecovery(){recoveryRequest('USERNAME_RECOVERY',{email:document.getElementById('recoveryEmail').value.trim()})}
function requestPasswordReset(){recoveryRequest('PASSWORD_RESET_REQUEST',{email:document.getElementById('recoveryEmail').value.trim()})}
function completePasswordReset(){recoveryRequest('PASSWORD_RESET',{email:document.getElementById('recoveryEmail').value.trim(),token:document.getElementById('recoveryToken').value.trim(),newPassword:document.getElementById('recoveryNewPassword').value})}
var idleTimer=null,idleEventsBound=false,idleLocked=false,IDLE_LIMIT_MS=10*60*1000;
function startIdleLock(){if(idleEventsBound)return;idleEventsBound=true;['mousemove','mousedown','keydown','touchstart','scroll'].forEach(function(ev){document.addEventListener(ev,registerActivity,{passive:true});});registerActivity();}
function registerActivity(){if(idleLocked)return;clearTimeout(idleTimer);idleTimer=setTimeout(lockSession,IDLE_LIMIT_MS);}
function lockSession(){var ctx=JSON.parse(localStorage.getItem('mantulAdminTenantContext')||'null');if(!ctx||!ctx.sessionToken)return;idleLocked=true;clearTimeout(idleTimer);var overlay=document.getElementById('idleLockOverlay');if(overlay){overlay.style.display='flex';var pin=document.getElementById('idleLockPin');if(pin){pin.value='';setTimeout(function(){pin.focus();},100);}}}
async function unlockIdleSession(){var ctx=JSON.parse(localStorage.getItem('mantulAdminTenantContext')||'null'),pin=(document.getElementById('idleLockPin')||{}).value||'',err=document.getElementById('idleLockError');if(!pin){if(err)err.textContent='PIN wajib diisi';return}try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'VERIFY_SESSION_PIN',sessionToken:ctx&&ctx.sessionToken,login:{pin:pin}})});var data=await r.json();if(data.status!=='success')throw new Error(data.message||'PIN tidak sesuai');idleLocked=false;document.getElementById('idleLockOverlay').style.display='none';if(err)err.textContent='';registerActivity();}catch(e){if(err)err.textContent='❌ '+e.message;}}
async function requestSensitiveApproval(action){var ctx=JSON.parse(localStorage.getItem('mantulAdminTenantContext')||'null'),pin=await jagoPrompt('Otorisasi Diperlukan','Masukkan PIN Supervisor/Admin untuk '+action+'.','','password');if(pin===null||!pin)return false;try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'VERIFY_APPROVAL_PIN',sessionToken:ctx&&ctx.sessionToken,approval:{pin:pin,action:action}})});var data=await r.json();if(data.status!=='success')throw new Error(data.message||'Otorisasi ditolak');return true;}catch(e){showToast(e.message,true);return false;}}
function logoutAccount(){clearTimeout(idleTimer);localStorage.removeItem('mantulAdminTenantContext');location.reload()}
async function exportTenantBackup(){var status=document.getElementById('backupStatus');var ctx=JSON.parse(localStorage.getItem('mantulAdminTenantContext')||'null');if(!ctx||String(ctx.role).toLowerCase()!=='admin'){if(status)status.textContent='❌ Hanya Admin yang dapat membuat backup tenant.';return;}if(status)status.textContent='⏳ Menyiapkan backup tenant...';try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'TENANT_BACKUP_EXPORT',sessionToken:ctx.sessionToken})});var data=await r.json();if(data.status!=='success')throw new Error(data.message||'Backup gagal');var blob=new Blob([JSON.stringify(data.result,null,2)],{type:'application/json'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='jagopos-backup-'+(ctx.tenantId||'tenant')+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);if(status)status.textContent='✅ Backup berhasil diunduh: '+a.download;}catch(e){if(status)status.textContent='❌ '+e.message;}}
async function restoreTenantBackup(file){if(!file)return;var status=document.getElementById('backupStatus'),ctx=JSON.parse(localStorage.getItem('mantulAdminTenantContext')||'null');if(!ctx||String(ctx.role).toLowerCase()!=='admin'){if(status)status.textContent='❌ Hanya Admin yang dapat melakukan restore.';return;}if(!confirm('Restore akan mengganti data tenant/cabang aktif. Pastikan backup terbaru sudah disimpan. Lanjutkan?'))return;try{if(status)status.textContent='⏳ Memeriksa file backup...';var backup=JSON.parse(await file.text());if(String((backup.identity||{}).tenantId)!==String(ctx.tenantId)||String((backup.identity||{}).branchId)!==String(ctx.branchId))throw new Error('Backup bukan milik tenant/cabang aktif');var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'TENANT_BACKUP_RESTORE',sessionToken:ctx.sessionToken,backup:backup})});var data=await r.json();if(data.status!=='success')throw new Error(data.message||'Restore gagal');if(status)status.textContent='✅ '+(data.result&&data.result.message||'Restore berhasil.');alert('Restore berhasil. Halaman akan dimuat ulang.');location.reload();}catch(e){if(status)status.textContent='❌ '+e.message;}}
async function holdCurrentOrder(){var ctx=getTenantContext();if(!ctx.sessionToken)return showToast('Sesi cloud diperlukan untuk menahan order.',true);if(!cart.length)return showToast('Keranjang masih kosong.',true);var label=await jagoPrompt('Tahan Order','Beri nama singkat agar order mudah ditemukan.',(document.getElementById('customerName')||{}).value||'Order '+new Date().toLocaleTimeString('id-ID'),'text');if(label===null)return;label=String(label||'').trim()||('Order '+new Date().toLocaleTimeString('id-ID'));var table=(document.getElementById('cashierSelectedTable')||{}).textContent||'Take Away',customer=(document.getElementById('customerName')||{}).value||'';try{showToast('Menyimpan order…',false,'loading');var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'ORDER_HOLD_SAVE',sessionToken:ctx.sessionToken,heldOrder:{label:label,tableName:table,customerName:customer,cart:cart,discount:Number((document.getElementById('cartDiscount')||{}).value||0),paymentMethod:(document.getElementById('paymentMethod')||{}).value||'CASH'}})});var data=await r.json();var loading=document.querySelector('.jago-toast.loading');if(loading)loading.remove();if(data.status!=='success')throw new Error(data.message||'Gagal menahan order');cart=[];renderCart();await loadHeldOrders();showToast('Order ditahan: '+label);}catch(e){var loading2=document.querySelector('.jago-toast.loading');if(loading2)loading2.remove();showToast(e.message,true);}}
async function loadHeldOrders(){var ctx=getTenantContext(),list=document.getElementById('heldOrderList');if(!list)return;if(!ctx.sessionToken){list.innerHTML='<div class="held-order-empty">Login cloud diperlukan untuk melihat order tertahan.</div>';return;}try{var r=await fetch(CLOUD_URL+'?resource=heldOrders&sessionToken='+encodeURIComponent(ctx.sessionToken),{method:'GET',mode:'cors'}),data=await r.json();if(data.status!=='success')throw new Error(data.message||'Gagal memuat order tertahan');heldOrdersCache=(data.heldOrders&&data.heldOrders.items)||[];renderHeldOrders();}catch(e){list.innerHTML='<div class="held-order-empty">'+String(e.message||'Order tertahan tidak tersedia')+'</div>';}}
function renderHeldOrders(){var list=document.getElementById('heldOrderList');if(!list)return;if(!heldOrdersCache.length){list.innerHTML='<div class="held-order-empty">Belum ada order tertahan.</div>';return;}list.innerHTML=heldOrdersCache.map(function(o){var count=(o.cart||[]).reduce(function(s,i){return s+Number(i.qty||0)},0);return '<div class="held-order-row"><div class="held-order-meta"><strong>'+escapeHtml_(o.label)+'</strong><small>'+escapeHtml_(o.tableName||'Take Away')+' · '+count+' item · '+formatDisplayDate(o.createdAt)+'</small></div><div class="held-order-row-actions"><button type="button" onclick="retrieveHeldOrder(\''+String(o.holdId).replace(/'/g,"\\'")+'\')">Lanjutkan</button><button type="button" onclick="cancelHeldOrder(\''+String(o.holdId).replace(/'/g,"\\'")+'\')">Hapus</button></div></div>';}).join('');}
function escapeHtml_(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
async function retrieveHeldOrder(holdId){var found=heldOrdersCache.find(function(o){return o.holdId===holdId});if(!found)return showToast('Order tertahan tidak ditemukan.',true);if(cart.length&&!(await jagoConfirm('Ganti Transaksi Aktif','Keranjang aktif akan diganti dengan order tertahan ini. Lanjutkan?')))return;var ctx=getTenantContext();try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'ORDER_RETRIEVE',sessionToken:ctx.sessionToken,heldOrder:{holdId:holdId}})}),data=await r.json();if(data.status!=='success')throw new Error(data.message||'Gagal mengambil order');var p=data.result||found;cart=Array.isArray(p.cart)?p.cart:[];var discount=document.getElementById('cartDiscount');if(discount)discount.value=Number(p.discount||0);var customer=document.getElementById('customerName');if(customer)customer.value=p.customerName||'';renderCart();await loadHeldOrders();showToast('Order dilanjutkan: '+(p.label||found.label));}catch(e){showToast(e.message,true);}}
async function cancelHeldOrder(holdId){if(!(await jagoConfirm('Hapus Order Tertahan','Order ini akan dibatalkan dari daftar Hold. Lanjutkan?')))return;var ctx=getTenantContext();try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'ORDER_HOLD_CANCEL',sessionToken:ctx.sessionToken,heldOrder:{holdId:holdId}})}),data=await r.json();if(data.status!=='success')throw new Error(data.message||'Gagal menghapus order');await loadHeldOrders();showToast('Order tertahan dihapus.');}catch(e){showToast(e.message,true);}}
var currentShiftSnapshot={status:'NONE'};
async function openCashierShift(){var ctx=getTenantContext(),value=await jagoPrompt('Buka Shift Kasir','Masukkan modal awal kas (Rp).','0','number');if(value===null)return;var opening=Number(value);if(!isFinite(opening)||opening<0)return showToast('Modal awal tidak valid',true);try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SHIFT_OPEN',sessionToken:ctx.sessionToken,shift:{openingCash:opening}})});var data=await r.json();if(data.status!=='success')throw new Error(data.message||'Gagal membuka shift');ctx.shiftId=data.result.shiftId;localStorage.setItem('mantulAdminTenantContext',JSON.stringify(ctx));updateShiftUI(data.result);showToast('Shift dibuka. Modal awal: '+formatRupiah(opening));}catch(e){showToast(e.message,true);}}
async function closeCashierShift(){var ctx=getTenantContext(),value=await jagoPrompt('Tutup Shift Kasir','Masukkan uang kas aktual saat tutup shift (Rp).','0','number');if(value===null)return;var closing=Number(value);if(!isFinite(closing)||closing<0)return showToast('Uang aktual tidak valid',true);var note=await jagoPrompt('Catatan Tutup Shift','Tambahkan catatan jika ada selisih atau kejadian khusus.','','text');if(note===null)return;try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SHIFT_CLOSE',sessionToken:ctx.sessionToken,shift:{closingCash:closing,note:note}})});var data=await r.json();if(data.status!=='success')throw new Error(data.message||'Gagal menutup shift');ctx.shiftId='';localStorage.setItem('mantulAdminTenantContext',JSON.stringify(ctx));updateShiftUI(Object.assign({},data.result));showToast('Shift ditutup · Expected '+formatRupiah(data.result.expectedCash)+' · Aktual '+formatRupiah(data.result.closingCash)+' · Selisih '+formatRupiah(data.result.difference));}catch(e){showToast(e.message,true);}}
async function refreshShiftStatus(){var ctx=getTenantContext();if(!ctx.sessionToken||['kasir','admin','supervisor'].indexOf(String(ctx.role).toLowerCase())<0)return;try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SHIFT_STATUS',sessionToken:ctx.sessionToken})});var data=await r.json();if(data.status==='success'){ctx.shiftId=data.result.status==='OPEN'?data.result.shiftId:'';localStorage.setItem('mantulAdminTenantContext',JSON.stringify(ctx));updateShiftUI(data.result);}}catch(e){console.warn('Status shift gagal',e);}}
function updateShiftUI(shift){currentShiftSnapshot=shift||{status:'NONE'};var text=document.getElementById('shiftStatusText'),open=document.getElementById('openShiftBtn'),close=document.getElementById('closeShiftBtn'),report=document.getElementById('shiftReportBtn'),isOpen=shift&&shift.status==='OPEN';if(text)text.textContent=isOpen?'Aktif · Modal '+formatRupiah(shift.openingCash||0):'Belum ada shift aktif';if(open)open.style.display=isOpen?'none':'inline-flex';if(close)close.style.display=isOpen?'inline-flex':'none';if(report)report.style.display=shift&&shift.shiftId?'inline-flex':'none';}
    function closeShiftReport(){var modal=document.getElementById('shiftReportModal');if(modal)modal.classList.remove('open');}
    function showShiftReport(){var shift=currentShiftSnapshot||{},modal=document.getElementById('shiftReportModal'),body=document.getElementById('shiftReportBody'),sub=document.getElementById('shiftReportSubtitle');if(!shift.shiftId)return showToast('Belum ada data shift untuk diringkas.',true);var rows=logs.filter(function(l){return String(l.shiftId||'')===String(shift.shiftId)&&String(l.type||'').toUpperCase()==='JUAL';}),by={},orders={};rows.forEach(function(l){var method=String(l.paymentMethod||'CASH').toUpperCase();by[method]=(by[method]||0)+Number(l.finalNominal||0)+Number(l.taxAmount||0)+Number(l.serviceChargeAmount||0);orders[l.orderId]=true;});var total=Object.keys(by).reduce(function(s,k){return s+by[k]},0);if(sub)sub.textContent='Shift '+shift.shiftId+' · '+Object.keys(orders).length+' order';if(body)body.innerHTML='<div>Modal Awal<strong>'+formatRupiah(shift.openingCash||0)+'</strong></div>'+Object.keys(by).map(function(k){return '<div>'+escapeHtml_(k)+'<strong>'+formatRupiah(by[k])+'</strong></div>';}).join('')+'<div>Total Penjualan<strong>'+formatRupiah(total)+'</strong></div>'+(shift.status==='CLOSED'?'<div>Kas Aktual<strong>'+formatRupiah(shift.closingCash||0)+'</strong></div><div>Selisih<strong>'+formatRupiah(shift.difference||0)+'</strong></div>':'<div>Kas Expected<strong>'+formatRupiah(Number(shift.openingCash||0)+(by.CASH||0))+'</strong></div>');if(modal)modal.classList.add('open');}
    function verifyPin() {
    try {
        var pin = document.getElementById('pinInput').value;
        var errEl = document.getElementById('pinError');
        if (!pin || pin.length === 0) { errEl.innerText = '❌ PIN tidak boleh kosong!'; return; }
        if (pin === '1234') {
            currentUserRole = 'admin';
            document.getElementById('userBadge').innerText = '👤 Admin Mode';
            document.getElementById('pinOverlay').style.display = 'none';
            applyRoleUI();
            initApp();
            alert('✅ Login sebagai ADMIN');
        } else if (pin === '0000') {
            currentUserRole = 'kasir';
            document.getElementById('userBadge').innerText = '👤 Kasir Mode';
            document.getElementById('pinOverlay').style.display = 'none';
            applyRoleUI();
            initApp();
            alert('✅ Login sebagai KASIR');
        } else {
            errEl.innerText = '❌ PIN Salah! Coba 1234 (Admin) atau 0000 (Kasir)';
            document.getElementById('pinInput').value = '';
            document.getElementById('pinInput').focus();
        }
    } catch (e) {
        alert('⚠️ Error login: ' + e.message);
        console.error('verifyPin error:', e);
    }
}

function applyRoleUI() {
    try {
        var isAdmin = (currentUserRole === 'admin');
        var toolsBox = document.getElementById('adminToolsBox'); // Box might not exist by this ID, checked below
        var exportBtn = document.getElementById('exportBtn');
        if(toolsBox) toolsBox.style.display = isAdmin ? 'block' : 'none';
        if(exportBtn) exportBtn.style.display = isAdmin ? 'block' : 'none';
        var tabs = ['btnTabMutasi','btnTabRevenue','btnTabSOH'];
        tabs.forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display = isAdmin ? 'inline-block' : 'none'; });
        if(!isAdmin){ var active = document.querySelector('.tab-content.active'); if(active && ['tabMutasi','tabRevenue','tabSOH'].indexOf(active.id) !== -1) switchTab('dashboard'); }
        var expensePanel=document.getElementById('expensePanel');if(expensePanel)expensePanel.style.display=(currentUserRole==='admin'||currentUserRole==='supervisor')?'block':'none';
        var actionType = document.getElementById('actionType');
        if(!isAdmin){ for(var i=0;i<actionType.options.length;i++){ if(actionType.options[i].value==='MASUK'||actionType.options[i].value==='TESTER') actionType.options[i].style.display='none'; } actionType.value='JUAL'; } else { for(var j=0;j<actionType.options.length;j++) actionType.options[j].style.display='block'; }
        var inputBox = document.getElementById('boxInput'); // Corrected ID
        if(inputBox) inputBox.classList.toggle('kasir-mode', !isAdmin);
        updateActionButton();
        applySettingsToUI();
        document.body.classList.toggle('kasir-mode', !isAdmin);
        applyVisibility();
        updateVisibilityButtons();
    } catch(e) { console.error('applyRoleUI error:', e); }
}

// ============================================================
// THEME
// ============================================================
var DEFAULT_THEMES = {
    admin: { bg:'#0b0b0c', card:'#171719', gold:'#d4af37', text:'#f5f5f5', muted:'#bdbdbd', border:'#2a2a2e', input:'#202023' },
    kasir: { bg:'#f5f7fa', card:'#ffffff', gold:'#0ea5e9', text:'#1a1a2e', muted:'#4a4a6a', border:'#d0d5dd', input:'#f0f2f5' }
};
function applyTheme(role) {
    try {
        var theme = (appSettings.themes && appSettings.themes[role]) || DEFAULT_THEMES[role] || DEFAULT_THEMES.admin;
        var root = document.documentElement;
        root.style.setProperty('--bg', theme.bg);
        root.style.setProperty('--card', theme.card);
        root.style.setProperty('--gold', theme.gold);
        root.style.setProperty('--text', theme.text);
        root.style.setProperty('--muted', theme.muted);
        root.style.setProperty('--border', theme.border);
        root.style.setProperty('--input', theme.input);
        var accentEl = document.getElementById('themeAccent');
        var bgEl = document.getElementById('themeBg');
        var cardEl = document.getElementById('themeCard');
        if(accentEl) accentEl.value = theme.gold;
        if(bgEl) bgEl.value = theme.bg;
        if(cardEl) cardEl.value = theme.card;
    } catch(e) { console.error('applyTheme error:', e); }
}
function loadPresetTheme(preset){ var role=currentUserRole||'admin'; var theme; if(preset==='dark') theme=DEFAULT_THEMES.admin; else if(preset==='light') theme=DEFAULT_THEMES.kasir; else if(preset==='green') theme={bg:'#f0fdf4',card:'#ffffff',gold:'#22c55e',text:'#14532d',muted:'#4ade80',border:'#bbf7d0',input:'#dcfce7'}; else if(preset==='sunset') theme={bg:'#1e1b2e',card:'#2d2a44',gold:'#f97316',text:'#fef3c7',muted:'#fb923c',border:'#44403c',input:'#3f3a5a'}; if(!appSettings.themes) appSettings.themes={}; appSettings.themes[role]=theme; saveToCloud(); applyTheme(role); var accentEl=document.getElementById('themeAccent'); var bgEl=document.getElementById('themeBg'); var cardEl=document.getElementById('themeCard'); if(accentEl) accentEl.value=theme.gold; if(bgEl) bgEl.value=theme.bg; if(cardEl) cardEl.value=theme.card; alert('✅ Tema "'+preset+'" diterapkan!'); }
function applyCurrentTheme(){ var role=currentUserRole||'admin'; var accent=document.getElementById('themeAccent').value; var bg=document.getElementById('themeBg').value; var card=document.getElementById('themeCard').value; if(!appSettings.themes) appSettings.themes={}; var base=DEFAULT_THEMES[role]||DEFAULT_THEMES.admin; appSettings.themes[role]={bg:bg, card:card, gold:accent, text:base.text, muted:base.muted, border:base.border, input:base.input}; saveToCloud(); applyTheme(role); alert('✅ Tema kustom disimpan ke Cloud!'); }

// ============================================================
// ACTION BUTTON
// ============================================================
function updateActionButton(){
    try {
        var action=document.getElementById('actionType').value;
        var btn=document.getElementById('actionButton');
        var unitGroup=document.getElementById('unitGroup');
        btn.className='btn'; btn.innerText='Proses';
        if(action==='JUAL'){ btn.innerText='➕ Tambahkan ke Keranjang'; btn.className='btn btn-add'; if(unitGroup) unitGroup.style.display='none'; }
        else if(action==='MASUK'){ btn.innerText='📥 Input Stok Masuk'; btn.className='btn btn-green'; if(unitGroup) unitGroup.style.display='block'; }
        else if(action==='TESTER'){ btn.innerText='🎁 Proses Tester'; btn.className='btn btn-orange'; if(unitGroup) unitGroup.style.display='none'; }
        updateItemPreview();
    } catch(e) { console.error('updateActionButton error:', e); }
}

// ============================================================
// SETTINGS
// ============================================================
function applySettingsToUI(){
    try {
        var s=appSettings||{};
        var set=function(id,val){ var el=document.getElementById(id); if(el){ if(el.type==='checkbox') el.checked=!!val; else el.value=val||''; } };
        set('setTaxRate',s.taxRate||0); set('setServiceChargeRate',s.serviceChargeRate||0); set('taxRateInput',s.taxRate||0); set('serviceChargeRateInput',s.serviceChargeRate||0); set('setShowSlogan',s.showSlogan); set('setShowAddress',s.showAddress); set('setShowWA',s.showWA); set('setShowFooter',s.showFooter); set('setShowDuplicate',s.showDuplicate);
        set('setSloganText',s.sloganText); set('setAddressText',s.addressText); set('setWAText',s.waText); set('setFooterText',s.footerText);
        applyVisibility(); updateVisibilityButtons(); applyTheme(currentUserRole||'admin');
    } catch(e) { console.error('applySettingsToUI error:', e); }
}
function collectSettingsFromUI(){
    try {
        var get=function(id){ var el=document.getElementById(id); if(!el) return null; if(el.type==='checkbox') return el.checked; return el.value; };
        appSettings.taxRate = Math.max(0,Math.min(100,Number(get('setTaxRate')||0)));
        appSettings.serviceChargeRate = Math.max(0,Math.min(100,Number(get('setServiceChargeRate')||0)));
        appSettings.showSlogan = (get('setShowSlogan') !== null) ? get('setShowSlogan') : true;
        appSettings.showAddress = (get('setShowAddress') !== null) ? get('setShowAddress') : true;
        appSettings.showWA = (get('setShowWA') !== null) ? get('setShowWA') : true;
        appSettings.showFooter = (get('setShowFooter') !== null) ? get('setShowFooter') : true;
        appSettings.showDuplicate = (get('setShowDuplicate') !== null) ? get('setShowDuplicate') : true;
        appSettings.sloganText = get('setSloganText') || '';
        appSettings.addressText = get('setAddressText') || '';
        appSettings.waText = get('setWAText') || '';
        appSettings.footerText = get('setFooterText') || '';
    } catch(e) { console.error('collectSettingsFromUI error:', e); }
}
function saveAppSettings(){ collectSettingsFromUI(); saveToCloud(); alert('✅ Pengaturan disimpan ke Cloud!'); }
function resetStrukDefault(){
    if(!confirm('Reset semua pengaturan struk ke default?')) return;
    appSettings.taxRate=0; appSettings.serviceChargeRate=0; appSettings.showSlogan=true; appSettings.showAddress=true; appSettings.showWA=true; appSettings.showFooter=true; appSettings.showDuplicate=true;
    appSettings.sloganText='"Kualitas Restoran Bintang Lima, Kini Hadir di Meja Makan Anda"';
    appSettings.addressText='📍 Jl. Contoh No. 123, Kota';
    appSettings.waText='📱 WA: 0881-0255-32438';
    appSettings.footerText='Terima kasih telah berbelanja di MANTUL KITCHEN! 🙏';
    applySettingsToUI(); saveToCloud(); alert('✅ Reset ke default berhasil!');
}

// ============================================================
// VISIBILITY
// ============================================================
function applyVisibility(){
    try {
        var role=currentUserRole||'admin'; var vis=(appSettings.visibility&&appSettings.visibility[role])||{};
        var boxes={ input:document.getElementById('boxInput'), cart:document.getElementById('boxCart'), theme:document.getElementById('boxTheme'), tools:document.getElementById('boxTools'), stock:document.getElementById('boxStock'), chart:document.getElementById('boxChart') };
        if(role!=='admin'&&boxes.tools) boxes.tools.style.display='none';
        else if(boxes.tools) boxes.tools.style.display=(vis.tools!==false)?'block':'none';
        if(boxes.input) boxes.input.style.display=(vis.input!==false)?'block':'none';
        if(boxes.cart) boxes.cart.style.display=(vis.cart!==false)?'block':'none';
        if(boxes.theme) boxes.theme.style.display=(vis.theme!==false)?'block':'none';
        if(boxes.stock) boxes.stock.style.display=(vis.stock!==false)?'block':'none';
        if(boxes.chart) boxes.chart.style.display=(vis.chart!==false)?'block':'none';
    } catch(e) { console.error('applyVisibility error:', e); }
}
function toggleVisibility(component){ var role=currentUserRole||'admin'; if(!appSettings.visibility) appSettings.visibility={}; if(!appSettings.visibility[role]) appSettings.visibility[role]={}; appSettings.visibility[role][component]=(appSettings.visibility[role][component]===undefined)?false:!appSettings.visibility[role][component]; updateVisibilityButtons(); applyVisibility(); saveToCloud(); }
function updateVisibilityButtons(){
    try {
        var role=currentUserRole||'admin'; var vis=(appSettings.visibility&&appSettings.visibility[role])||{};
        var components=['input','cart','theme','tools','stock','chart'];
        var labels={input:'Input',cart:'Keranjang',theme:'Tema',tools:'Tools',stock:'Stok',chart:'Grafik'};
        components.forEach(function(c){ var btn=document.getElementById('visBtn'+c.charAt(0).toUpperCase()+c.slice(1)); if(!btn) return; var isVisible=(vis[c]===undefined)?true:vis[c]; btn.innerHTML=(isVisible?'👁️':'👁️‍🗨️')+' '+labels[c]; btn.style.opacity=isVisible?'1':'0.5'; btn.style.borderColor=isVisible?'var(--gold)':'var(--danger)'; });
    } catch(e) { console.error('updateVisibilityButtons error:', e); }
}

// ============================================================
// PRODUCT CATALOG & STOCK
// ============================================================
var NOW=Date.now();
var productCatalog={}, inventory={}, logs=[], salesChartInstance=null, variantRows=[], editingProductName=null, filteredLogs=[];
var revenueChartInstance=null;

function loadProductCatalog(){ try { var stored=localStorage.getItem('productCatalog'); if(stored){ try{ productCatalog=JSON.parse(stored); } catch(e){ productCatalog={}; } } else { productCatalog={}; } } catch(e){ productCatalog={}; } }
function saveProductCatalog(){ try { localStorage.setItem('productCatalog',JSON.stringify(productCatalog)); } catch(e){} }

function getProductName(sku){
    try {
        if (productCatalog && productCatalog[sku]) {
            var name = productCatalog[sku].name || productCatalog[sku].productName || '';
            if (name && name !== sku) return name;
        }
        if (FALLBACK_PRODUCT_NAMES[sku]) return FALLBACK_PRODUCT_NAMES[sku];
        if (DEFAULT_PRODUCTS[sku]) return DEFAULT_PRODUCTS[sku].name || sku;
        return sku;
    } catch(e) { return sku; }
}
function getProductList(){
    try {
        return getSkuList().map(function(sku){
            return { sku: sku, name: getProductName(sku) };
        });
    } catch(e) { return []; }
}
function getCogs(sku){ try { return productCatalog[sku]?productCatalog[sku].cogs:0; } catch(e){ return 0; } }
function getVariants(sku){ try { return productCatalog[sku]?productCatalog[sku].variants:[]; } catch(e){ return []; } }
function getRetailPrice(sku){ try { var variants=getVariants(sku); if(!variants||variants.length===0)return 0; var total=0; variants.forEach(function(v){ total+=v.pricePerPack/v.pcsPerPack; }); return total/variants.length; } catch(e){ return 0; } }
function getSkuList(){ try { return Object.keys(productCatalog).sort(); } catch(e){ return []; } }

// ============================================================
// DATE FILTER
// ============================================================
function applyDateFilter(mode){
    try {
        document.querySelectorAll('.date-filter button').forEach(function(b){ b.classList.remove('active'); });
        var today = new Date(); var start = new Date(), end = new Date();
        
        if(mode === 'today'){ 
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate()); 
            end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999); 
            document.querySelector('.date-filter button:nth-child(2)').classList.add('active'); 
        }
        else if(mode === 'week'){ 
            var day = today.getDay() || 7; 
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day + 1); 
            end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (7 - day), 23, 59, 59, 999); 
            document.querySelector('.date-filter button:nth-child(3)').classList.add('active'); 
        }
        else if(mode === 'month'){ 
            start = new Date(today.getFullYear(), today.getMonth(), 1); 
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999); 
            document.querySelector('.date-filter button:nth-child(4)').classList.add('active'); 
        }
        else if(mode === 'all'){ 
            start = new Date(2000, 0, 1); 
            end = new Date(2100, 0, 1, 23, 59, 59, 999); 
            document.querySelector('.date-filter button:nth-child(5)').classList.add('active'); 
        }
        else if(mode === 'custom'){ 
            var s = document.getElementById('startDate').value; 
            var e = document.getElementById('endDate').value; 
            if(s) start = new Date(s); 
            if(e) { end = new Date(e); end.setHours(23, 59, 59, 999); } 
            if(!s || !e) return; 
        }
        
        currentPeriod = mode; 
        filteredLogs = logs.filter(function(l){ 
            var d = parseDate(l.date); 
            return d >= start && d <= end; 
        }); 
        renderDashboard();
    } catch(e){ console.error('applyDateFilter error:', e); }
}

// ============================================================
// PARETO & FORECAST
// ============================================================
function calculatePareto(){ try { var sales={}; filteredLogs.forEach(function(l){ if(l.type==='JUAL'){ var name=getProductName(l.sku)||l.productName||l.product; if(!sales[name])sales[name]=0; sales[name]+=l.qtyInput; } }); var sorted=Object.entries(sales).sort(function(a,b){ return b[1]-a[1]; }); return {top:sorted.slice(0,5), bottom:sorted.slice(-5).reverse()}; } catch(e){ return {top:[], bottom:[]}; } }
function getForecastDays(sku){ try { var now=new Date(); var weekAgo=new Date(now.getTime()-7*24*60*60*1000); var recent=logs.filter(function(l){ return l.sku===sku&&l.type==='JUAL'&&parseDate(l.date)>=weekAgo; }); if(recent.length===0)return '-'; var total=recent.reduce(function(s,l){ return s+l.qtyInput; },0); var avg=total/7; if(avg<0.1)return '🟢 Aman'; var days=Math.floor((inventory[sku]||0)/avg); if(days<=0)return '⚠️ <1 hari'; if(days<=3)return '🔴 '+days+' hari'; if(days<=7)return '🟡 '+days+' hari'; return '🟢 '+days+' hari'; } catch(e){ return '-'; } }

// ============================================================
// SWITCH TAB
// ============================================================
function switchTab(t){
    try {
        var tabs=['dashboard','profit','mutasi','revenue','soh'];
        tabs.forEach(function(id){ var content=document.getElementById('tab'+id.charAt(0).toUpperCase()+id.slice(1)); var btn=document.getElementById('btnTab'+id.charAt(0).toUpperCase()+id.slice(1)); if(content) content.classList.toggle('active', id===t); if(btn) btn.classList.toggle('active', id===t); });
        if(t==='mutasi') renderMutasi(); else if(t==='revenue') renderRevenue(); else if(t==='soh') renderSOH();
    } catch(e){ console.error('switchTab error:', e); }
}

// ============================================================
// PRODUK CRUD
// ============================================================
function cloneProduct(sku){ if(currentUserRole!=='admin')return alert('Akses ditolak!'); var prod=productCatalog[sku]; if(!prod)return alert('Tidak ditemukan!'); toggleAddMenuForm(); document.getElementById('newProductName').value=prod.name+' Copy'; document.getElementById('newProductCogs').value=prod.cogs; document.getElementById('newProductStock').value=inventory[sku]||0;document.getElementById('newProductMinStock').value=prod.minStock||5;document.getElementById('newProductReorderQty').value=prod.reorderQty||20; variantRows=prod.variants.map(function(v){ return {label:v.label, pcsPerPack:v.pcsPerPack, pricePerPack:v.pricePerPack}; }); renderVariantRows(); editingProductName=null; document.getElementById('formTitle').innerText='📋 Clone Produk'; document.getElementById('saveProductBtn').innerText='Simpan Clone'; document.getElementById('addMenuForm').scrollIntoView({behavior:'smooth'}); }
function editProduct(sku){ if(currentUserRole!=='admin')return alert('Akses ditolak!'); var prod=productCatalog[sku]; if(!prod)return alert('Tidak ditemukan!'); editingProductName=sku; document.getElementById('formTitle').innerText='✏️ Edit Produk'; document.getElementById('saveProductBtn').innerText='🔄 Update'; document.getElementById('newProductName').value=prod.name; document.getElementById('newProductCogs').value=prod.cogs; document.getElementById('newProductStock').value=inventory[sku]||0;document.getElementById('newProductMinStock').value=prod.minStock||5;document.getElementById('newProductReorderQty').value=prod.reorderQty||20; variantRows=prod.variants.map(function(v){ return {label:v.label, pcsPerPack:v.pcsPerPack, pricePerPack:v.pricePerPack}; }); renderVariantRows(); document.getElementById('addMenuForm').style.display='block'; document.getElementById('addMenuForm').scrollIntoView({behavior:'smooth'}); }
function deleteProduct(sku){ if(currentUserRole!=='admin')return alert('Akses ditolak!'); if(!sku)return; var name=getProductName(sku); var hasLog=logs.some(function(l){ return l.sku===sku; }); var msg='Yakin hapus "'+name+'"?'; if(hasLog)msg+='\n⚠️ Ada '+logs.filter(function(l){ return l.sku===sku; }).length+' transaksi historis.'; if(!confirm(msg))return; delete productCatalog[sku]; delete inventory[sku]; saveProductCatalog(); saveToCloud(); populateProductDropdown(); updatePackageOptions(); renderDashboard(); alert('✅ "'+name+'" dihapus.'); }
function openTesterEntry(){var isFull=document.body.classList.contains('cashier-fullscreen');if(isFull)document.body.classList.add('cashier-tester-mode');if(typeof selectTransactionAction==='function')selectTransactionAction('TESTER');var input=document.getElementById('actionType');if(input){setTimeout(function(){input.scrollIntoView({behavior:'smooth',block:'center'});},80);}}
function selectTransactionAction(action){var el=document.getElementById('actionType');if(!el)return;el.value=action;updateActionButton();updateItemPreview();var shortcut=document.querySelector('.activity-shortcut');if(shortcut)shortcut.classList.toggle('is-active',action==='TESTER');}
function openManualMenuForm(){if(typeof openInventorySection==='function')openInventorySection('catalog');var form=document.getElementById('addMenuForm');if(form){form.style.display='block';setTimeout(function(){form.scrollIntoView({behavior:'smooth',block:'start'});},60);}}
function toggleAddMenuForm(){ if(currentUserRole!=='admin')return alert('Akses ditolak!'); var form=document.getElementById('addMenuForm'); if(form.style.display==='block'){ cancelEdit(); return; } editingProductName=null; document.getElementById('formTitle').innerText='➕ Tambah Produk Baru'; document.getElementById('saveProductBtn').innerText='Simpan Produk'; document.getElementById('newProductName').value=''; document.getElementById('newProductCogs').value=''; document.getElementById('newProductStock').value='0';document.getElementById('newProductMinStock').value='5';document.getElementById('newProductReorderQty').value='20'; variantRows=[]; renderVariantRows(); addVariantRow(); form.style.display='block'; form.scrollIntoView({behavior:'smooth'}); }
function cancelEdit(){ document.getElementById('addMenuForm').style.display='none'; editingProductName=null; }
function addVariantRow(){ variantRows.push({label:'',pcsPerPack:1,pricePerPack:0}); renderVariantRows(); }
function removeVariantRow(idx){ if(variantRows.length<=1)return alert('Minimal 1 varian!'); variantRows.splice(idx,1); renderVariantRows(); }
function renderVariantRows(){ var container=document.getElementById('variantList'); container.innerHTML=''; variantRows.forEach(function(v,i){ var div=document.createElement('div'); div.className='variant-row'; div.innerHTML='<input type="text" placeholder="Label" value="'+v.label+'" onchange="updateVariant('+i+',\'label\',this.value)"><input type="number" placeholder="Isi" value="'+v.pcsPerPack+'" onchange="updateVariant('+i+',\'pcsPerPack\',parseInt(this.value)||0)"><input type="number" placeholder="Harga" value="'+v.pricePerPack+'" onchange="updateVariant('+i+',\'pricePerPack\',parseInt(this.value)||0)"><button onclick="removeVariantRow('+i+')">✕</button>'; container.appendChild(div); }); }
function updateVariant(idx,field,val){ variantRows[idx][field]=val; }

function saveNewProduct(){
    try {
        if(currentUserRole!=='admin')return alert('Akses ditolak!');
        var name=document.getElementById('newProductName').value.trim();
        var cogs=parseInt(document.getElementById('newProductCogs').value)||0;
        var stock=parseInt(document.getElementById('newProductStock').value)||0;var minStock=Math.max(0,parseInt(document.getElementById('newProductMinStock').value)||0);var reorderQty=Math.max(1,parseInt(document.getElementById('newProductReorderQty').value)||1);
        if(!name)return alert('Nama wajib!');
        if(cogs<=0)return alert('HPP > 0!');
        if(variantRows.length===0)return alert('Minimal 1 varian!');
        for(var v=0;v<variantRows.length;v++){ if(!variantRows[v].label.trim()||variantRows[v].pcsPerPack<=0||variantRows[v].pricePerPack<=0)return alert('Lengkapi varian!'); }
        var now=Date.now();
        var targetSku=editingProductName;
        var isNew=false;
        if(!targetSku||!productCatalog[targetSku]){
            var existingSkus=Object.keys(productCatalog);
            var lastNum=existingSkus.reduce(function(max,s){ var num=parseInt(s.replace('M-','')); return num>max?num:max; },0);
            targetSku=generateSKU(lastNum);
            isNew=true;
        }
        if(isNew&&productCatalog[targetSku]){ if(!confirm('Nama "'+name+'" mungkin sudah ada. Timpa?'))return; }
        productCatalog[targetSku]={ sku:targetSku, name:name, cogs:cogs, minStock:minStock, reorderQty:reorderQty, variants:variantRows.map(function(v){ return {label:v.label.trim(), pcsPerPack:v.pcsPerPack, pricePerPack:v.pricePerPack}; }), createdAt:productCatalog[targetSku]?productCatalog[targetSku].createdAt:now, updatedAt:now };
        inventory[targetSku]=stock;
        saveProductCatalog();
        saveToCloud();
        populateProductDropdown();
        document.getElementById('prodSelect').value = targetSku;
        updatePackageOptions();
        renderDashboard();
        document.getElementById('addMenuForm').style.display='none';
        alert('✅ Produk "'+name+'" disimpan!');
    } catch(e) { console.error('saveNewProduct error:', e); alert('⚠️ Error: '+e.message); }
}

// ============================================================
// PREVIEW & ACTION (DENGAN VALIDASI STOK)
// ============================================================
function updateItemPreview(){
    try {
        var sku=document.getElementById('prodSelect').value;
        var qty=parseInt(document.getElementById('txQty').value)||0;
        var action=document.getElementById('actionType').value;
        var variants=getVariants(sku);
        var impactEl=document.getElementById('preImpact');
        var unitGroup=document.getElementById('unitGroup');
        var unitSelect=document.getElementById('txUnit');
        if(action==='MASUK'||action==='TESTER'){ if(unitGroup) unitGroup.style.display='block'; } else { if(unitGroup) unitGroup.style.display='none'; }
        if(variants.length===0){ document.getElementById('prePackPrice').innerText='Rp 0'; document.getElementById('preTotalPcs').innerText='0'; impactEl.innerText='-'; return; }
        var isPure=(variants.length===1&&variants[0].pcsPerPack===1);
        var idx=0; if(!isPure)idx=parseInt(document.getElementById('packSelect').value)||0;
        var pack=variants[idx];
        if(pack){
            document.getElementById('prePackPrice').innerText=formatRupiah(pack.pricePerPack);
            var totalPcs = pack.pcsPerPack*qty;
            if((action==='MASUK'||action==='TESTER') && unitSelect && unitSelect.value==='Pcs'){ totalPcs = qty; }
            document.getElementById('preTotalPcs').innerText=totalPcs+' Pcs';
            if(action==='MASUK'){ impactEl.innerText='+'+totalPcs+' Pcs (Stok bertambah)'; impactEl.style.color='var(--success)'; }
            else if(action==='TESTER'){ impactEl.innerText='-'+totalPcs+' Pcs (Promosi)'; impactEl.style.color='var(--warning)'; }
            else { impactEl.innerText='-'+totalPcs+' Pcs (Penjualan)'; impactEl.style.color='var(--danger)'; }
        }
    } catch(e){ console.error('updateItemPreview error:', e); }
}

function processAction(){
    try {
        var sku=document.getElementById('prodSelect').value;
        var qty=parseInt(document.getElementById('txQty').value)||0;
        var action=document.getElementById('actionType').value;
        var prodName=getProductName(sku);
        if(qty<=0)return alert('Qty harus > 0!');
        var variants=getVariants(sku);
        if(variants.length===0)return alert('Tidak ada varian!');
        var isPure=(variants.length===1&&variants[0].pcsPerPack===1);
        var idx=0; if(!isPure)idx=parseInt(document.getElementById('packSelect').value)||0;
        var pack=variants[idx]; if(!pack)return;
        var totalPcs = pack.pcsPerPack * qty;
        if(action==='MASUK'||action==='TESTER'){
            var unit=document.getElementById('txUnit').value;
            if(unit==='Pcs'){ totalPcs = qty; }
        }
        var subtotal=pack.pricePerPack*qty;
        var cogsTotal=totalPcs*getCogs(sku);
        
        if(action==='MASUK' || action==='TESTER'){
            if(currentUserRole!=='admin')return alert('Hanya Admin!');
            if(action==='MASUK'){
                inventory[sku]=(inventory[sku]||0)+totalPcs;
                var log={ orderId:'STOCK-'+Date.now().toString().slice(-8), date:generateFormattedDate(), sku:sku, product:prodName, type:'MASUK', qtyInput:qty, detail:pack.label+' (+'+totalPcs+' Pcs)', impactStock:'Masuk '+totalPcs+' Pcs', finalDeduct:totalPcs, grossPrice:0, discount:0, cogsTotal:0, finalNominal:0, netProfit:0, customerName:'Admin', productName:prodName };
                logs.unshift(log);
                saveToCloud(); renderDashboard();
                alert('✅ Stok "'+prodName+'" bertambah '+totalPcs+' Pcs');
            } else if(action==='TESTER'){
                if((inventory[sku]||0)<totalPcs)return alert('⚠️ Stok tidak cukup! Sisa stok '+(inventory[sku]||0)+' Pcs, tapi butuh '+totalPcs+' Pcs');
                inventory[sku]-=totalPcs;
                var log2={ orderId:'TEST-'+Date.now().toString().slice(-8), date:generateFormattedDate(), sku:sku, product:prodName, type:'TESTER', qtyInput:qty, detail:pack.label+' (-'+totalPcs+' Pcs Promo)', impactStock:'Keluar '+totalPcs+' Pcs', finalDeduct:totalPcs, grossPrice:0, discount:0, cogsTotal:cogsTotal, finalNominal:0, netProfit:-cogsTotal, customerName:'Admin', productName:prodName };
                logs.unshift(log2);
                saveToCloud(); renderDashboard();
                alert('✅ Tester "'+prodName+'" selesai (-'+totalPcs+' Pcs)');
            }
            document.getElementById('txQty').value='1';
            updateItemPreview();
            return;
        }
        
        // VALIDASI STOK SEBELUM TAMBAH KE KERANJANG
        if((inventory[sku]||0)<totalPcs)return alert('⚠️ Stok tidak cukup! Sisa stok '+(inventory[sku]||0)+' Pcs, tapi butuh '+totalPcs+' Pcs');
        var existing=cart.findIndex(function(item){ return item.sku===sku&&item.variantIndex===idx; });
        if(existing!==-1){
            var newQty=cart[existing].qty+qty;
            var newTotal=cart[existing].pcsPerPack*newQty;
            if((inventory[sku]||0)<newTotal)return alert('⚠️ Stok tidak cukup! Anda butuh total '+newTotal+' Pcs');
            cart[existing].qty=newQty;
            cart[existing].totalPcs=newTotal;
            cart[existing].subtotal=cart[existing].pricePerPack*newQty;
            cart[existing].cogsTotal=newTotal*getCogs(sku);
        } else {
            cart.push({ sku:sku, productName:prodName, variantIndex:idx, qty:qty, pricePerPack:pack.pricePerPack, pcsPerPack:pack.pcsPerPack, totalPcs:totalPcs, subtotal:subtotal, cogsTotal:cogsTotal, label:pack.label, action:'JUAL' });
        }
        renderCart();
        document.getElementById('txQty').value='1';
        updateItemPreview();
    } catch(e){ console.error('processAction error:', e); alert('⚠️ Error: '+e.message); }
}

// ============================================================
// CART
// ============================================================
function removeFromCart(index){ if(index>=0&&index<cart.length){ cart.splice(index,1); renderCart(); } }
function clearCart(){ if(cart.length===0)return; if(confirm('Kosongkan keranjang?')){ cart=[]; renderCart(); } }
function renderCart(){ try { var container=document.getElementById('cartItemsContainer'); var summary=document.getElementById('cartSummary'); var count=document.getElementById('cartCount'); count.innerText=cart.length+' Item'; if(cart.length===0){ container.innerHTML='<div class="empty-cart-msg">Keranjang kosong.</div>'; summary.style.display='none'; return; } var html='', subtotal=0; cart.forEach(function(item,idx){ subtotal+=item.subtotal; html+='<div class="cart-item-row"><div class="item-info"><b>'+item.productName+'</b><br><small style="color:var(--muted);">'+item.label+' x '+item.qty+'</small></div><div class="item-price">'+formatRupiah(item.subtotal)+'</div><div class="item-actions"><button class="btn-remove-cart" onclick="removeFromCart('+idx+')">✕</button></div></div>'; }); container.innerHTML=html; summary.style.display='block'; document.getElementById('cartSubtotal').innerText=formatRupiah(subtotal); updateCartSummary(); } catch(e){ console.error('renderCart error:', e); } }
function getCartTotals(){var sub=cart.reduce(function(s,i){return s+Number(i.subtotal||0)},0),disc=Math.max(0,Number((document.getElementById('cartDiscount')||{}).value||0)),taxable=Math.max(0,sub-disc),taxRate=Math.max(0,Math.min(100,Number((document.getElementById('taxRateInput')||{}).value||appSettings.taxRate||0))),serviceRate=Math.max(0,Math.min(100,Number((document.getElementById('serviceChargeRateInput')||{}).value||appSettings.serviceChargeRate||0))),tax=Math.round(taxable*taxRate/100),service=Math.round(taxable*serviceRate/100);return {subtotal:sub,discount:Math.min(disc,sub),taxable:taxable,taxRate:taxRate,serviceRate:serviceRate,tax:tax,service:service,total:taxable+tax+service};}
function updateCartSummary(){try{var t=getCartTotals(),sub=document.getElementById('cartSubtotal'),tax=document.getElementById('cartTaxAmount'),service=document.getElementById('cartServiceAmount'),total=document.getElementById('cartGrandTotal');if(sub)sub.innerText=formatRupiah(t.subtotal);if(tax)tax.innerText=formatRupiah(t.tax);if(service)service.innerText=formatRupiah(t.service);if(total)total.innerText=formatRupiah(t.total);updateChange();}catch(e){console.error('updateCartSummary error:',e);}}
function updateChange(){try{var t=getCartTotals(),method=document.getElementById('paymentMethod'),tender=document.getElementById('cashTendered'),change=document.getElementById('cashChange');if(!tender||!change)return;var isCash=!method||method.value==='CASH';tender.disabled=!isCash;if(!isCash){tender.value=t.total;change.innerText='Non-tunai';change.style.color='var(--success)';return}var received=Number(tender.value)||0,delta=received-t.total;change.innerText=delta>=0?formatRupiah(delta):'Kurang '+formatRupiah(Math.abs(delta));change.style.color=delta>=0?'var(--success)':'var(--danger)';}catch(e){console.error('updateChange error:',e);}}
function updateChangeLegacy(){ try { var sub=cart.reduce(function(s,i){ return s+i.subtotal; },0); var disc=parseInt(document.getElementById('cartDiscount').value)||0; var total=Math.max(0,sub-disc); var method=document.getElementById('paymentMethod'); var tender=document.getElementById('cashTendered'); var change=document.getElementById('cashChange'); if(!tender||!change)return; var isCash=!method||method.value==='CASH'; tender.disabled=!isCash; if(!isCash){tender.value=total;change.innerText='Non-tunai';change.style.color='var(--success)';return} var received=parseInt(tender.value)||0; var delta=received-total; change.innerText=delta>=0?formatRupiah(delta):'Kurang '+formatRupiah(Math.abs(delta)); change.style.color=delta>=0?'var(--success)':'var(--danger)'; } catch(e){ console.error('updateChange error:',e); } }

function closeSplitBill(){var modal=document.getElementById('splitBillModal');if(modal)modal.classList.remove('open');}
function splitBillPreview(){var body=document.getElementById('splitBillBody');if(!body)return;var totalA=0,totalB=0;body.querySelectorAll('input[data-split-index]').forEach(function(input){var idx=Number(input.dataset.splitIndex),item=cart[idx],a=Math.max(0,Math.min(item.qty,parseInt(input.value)||0)),b=item.qty-a,totalAItem=item.pricePerPack*a,totalBItem=item.pricePerPack*b;totalA+=totalAItem;totalB+=totalBItem;var remainder=document.getElementById('splitRemainder'+idx);if(remainder)remainder.textContent=b;});var a=document.getElementById('splitBillATotal'),b=document.getElementById('splitBillBTotal');if(a)a.textContent=formatRupiah(totalA);if(b)b.textContent=formatRupiah(totalB);}
function openSplitBill(){if(splitBills)return showToast('Selesaikan split bill yang sedang berjalan terlebih dahulu.',true);if(cart.length<1)return showToast('Keranjang kosong.',true);if(cart.reduce(function(s,i){return s+Number(i.qty||0)},0)<2)return showToast('Minimal total qty adalah 2 untuk Split Bill.',true);var body=document.getElementById('splitBillBody');if(!body)return;body.innerHTML='<table class="split-bill-table"><thead><tr><th>Item</th><th>Total Qty</th><th>Bill A</th><th>Bill B</th></tr></thead><tbody>'+cart.map(function(item,idx){var suggested=Math.ceil(item.qty/2);return '<tr><td><strong>'+escapeHtml_(item.productName)+'</strong><br><small>'+escapeHtml_(item.label||'')+'</small></td><td>'+item.qty+'</td><td><input type="number" min="0" max="'+item.qty+'" value="'+suggested+'" data-split-index="'+idx+'" oninput="splitBillPreview()"></td><td><span id="splitRemainder'+idx+'">'+(item.qty-suggested)+'</span></td></tr>';}).join('')+'</tbody></table>';document.getElementById('splitBillModal').classList.add('open');splitBillPreview();}
function cloneSplitItem(item,qty){var copy=Object.assign({},item),n=Number(qty||0);copy.qty=n;copy.totalPcs=Number(copy.pcsPerPack||1)*n;copy.subtotal=Number(copy.pricePerPack||0)*n;copy.cogsTotal=copy.totalPcs*getCogs(copy.sku);return copy;}
function applySplitBill(){var modal=document.getElementById('splitBillModal'),body=document.getElementById('splitBillBody');if(!body)return;var a=[],b=[],totalA=0,totalB=0;body.querySelectorAll('input[data-split-index]').forEach(function(input){var idx=Number(input.dataset.splitIndex),item=cart[idx],qtyA=Math.max(0,Math.min(item.qty,parseInt(input.value)||0)),qtyB=item.qty-qtyA;if(qtyA)a.push(cloneSplitItem(item,qtyA));if(qtyB)b.push(cloneSplitItem(item,qtyB));totalA+=item.pricePerPack*qtyA;totalB+=item.pricePerPack*qtyB;});if(!a.length||!b.length)return showToast('Bill A dan Bill B harus masing-masing memiliki item.',true);var discount=Number((document.getElementById('cartDiscount')||{}).value||0),customer=(document.getElementById('customerName')||{}).value.trim()||'-',sum=totalA+totalB;splitCustomerName=customer;splitBills=[{name:'Bill A',cart:a,discount:sum?Math.round(discount*totalA/sum):0,status:'PENDING'},{name:'Bill B',cart:b,discount:sum?discount-Math.round(discount*totalA/sum):0,status:'PENDING'}];splitCurrentIndex=0;cart=a;document.getElementById('cartDiscount').value=splitBills[0].discount;document.getElementById('customerName').value=customer+' · Bill A';if(modal)modal.classList.remove('open');renderCart();showToast('Split Bill dibuat. Selesaikan Bill A terlebih dahulu.');}

// ============================================================
// CHECKOUT (DENGAN VALIDASI STOK EKSTRA AMAN)
// ============================================================
async function checkoutOrder(){if(currentUserRole==='kasir'&&!getTenantContext().shiftId)return alert('⚠️ Buka Shift Kasir terlebih dahulu sebelum transaksi.');
    try {
        if(cart.length===0)return alert('Keranjang kosong!');
        var discount=parseInt(document.getElementById('cartDiscount').value)||0;
        var customerName=document.getElementById('customerName').value.trim()||'-';
        var paymentMethod=(document.getElementById('paymentMethod')||{}).value||'CASH';
        var subtotal=cart.reduce(function(s,i){ return s+i.subtotal; },0);
        var totals=getCartTotals();
        discount=totals.discount;
        var totalDue=totals.total;
        if(discount>0&&discount>=Math.max(50000,subtotal*0.1)&&!(await requestSensitiveApproval('diskon besar')))return;
        var cashTendered=parseInt((document.getElementById('cashTendered')||{}).value)||0;
        if(paymentMethod==='CASH'&&cashTendered<totalDue)return alert('Uang diterima belum cukup. Kurang '+formatRupiah(totalDue-cashTendered));
        var cashChange=paymentMethod==='CASH'?Math.max(0,cashTendered-totalDue):0;
        if(discount>subtotal)return alert('Diskon > Subtotal!');
        
        // VALIDASI STOK BERLAPIS (Anti-Minus)
        var tempInventory = Object.assign({}, inventory);
        for(var i=0; i<cart.length; i++){
            var item = cart[i];
            if((tempInventory[item.sku]||0) < item.totalPcs) {
                return alert('⚠️ Transaksi Batal: Stok ' + item.productName + ' tidak mencukupi!\nSisa stok riil: ' + (tempInventory[item.sku]||0) + ' Pcs, tapi keranjang butuh ' + item.totalPcs + ' Pcs.');
            }
            tempInventory[item.sku] -= item.totalPcs; // Kurangi dari temporary
        }

        var orderId='ORD-'+Date.now().toString().slice(-8);
        var transactionLogs=[];
        var grossTotal=0;
        
        // POTONG STOK ASLI JIKA SUDAH LOLOS VALIDASI
        for(var i=0;i<cart.length;i++){
            var item=cart[i];
            inventory[item.sku]-=item.totalPcs;
            var log={ orderId:orderId, shiftId:(getTenantContext().shiftId||''), date:generateFormattedDate(), sku:item.sku, product:item.productName, type:'JUAL', qtyInput:item.qty, detail:item.label+' ('+item.totalPcs+' Pcs)', impactStock:'Keluar '+item.totalPcs+' Pcs', finalDeduct:item.totalPcs, grossPrice:item.subtotal, discount:0, cogsTotal:item.cogsTotal, finalNominal:item.subtotal, netProfit:item.subtotal-item.cogsTotal, customerName:customerName, productName:item.productName, paymentMethod:paymentMethod, cashTendered:cashTendered, cashChange:cashChange, taxAmount:0, serviceChargeAmount:0, taxRate:totals.taxRate, serviceChargeRate:totals.serviceRate };
            transactionLogs.push(log);
            grossTotal+=item.subtotal;
        }
        
        // DISTRIBUSI DISKON
        if(transactionLogs.length>0&&discount>0){
            var remaining=discount;
            for(var j=0;j<transactionLogs.length;j++){
                var log=transactionLogs[j];
                var prop=log.grossPrice/grossTotal;
                var alloc=Math.round(discount*prop);
                if(j===transactionLogs.length-1)alloc=remaining;
                remaining-=alloc;
                log.discount=alloc;
                log.finalNominal=log.grossPrice-alloc;
                log.netProfit=log.finalNominal-log.cogsTotal;
            }
        }
        
        var totalFinal=transactionLogs.reduce(function(s,l){ return s+l.finalNominal; },0);
        transactionLogs.forEach(function(l){var share=totalFinal?l.finalNominal/totalFinal:0;l.taxAmount=Math.round(totals.tax*share);l.serviceChargeAmount=Math.round(totals.service*share);});
        var feeRemainderTax=totals.tax-transactionLogs.reduce(function(s,l){return s+l.taxAmount;},0),feeRemainderService=totals.service-transactionLogs.reduce(function(s,l){return s+l.serviceChargeAmount;},0);if(transactionLogs.length){transactionLogs[transactionLogs.length-1].taxAmount+=feeRemainderTax;transactionLogs[transactionLogs.length-1].serviceChargeAmount+=feeRemainderService;}
        logs.unshift.apply(logs, transactionLogs);
        saveToCloud();
        showCombinedReceipt(orderId, transactionLogs, discount, totalFinal+totals.tax+totals.service, customerName, false, {tax:totals.tax,service:totals.service,taxRate:totals.taxRate,serviceRate:totals.serviceRate});
        if(splitBills){
            splitBills[splitCurrentIndex].status='PAID';
            var nextIndex=splitBills.findIndex(function(b){return b.status==='PENDING';});
            if(nextIndex!==-1){
                splitCurrentIndex=nextIndex;
                cart=splitBills[nextIndex].cart;
                document.getElementById('cartDiscount').value=splitBills[nextIndex].discount;
                document.getElementById('customerName').value=splitCustomerName+' · '+splitBills[nextIndex].name;
                if(document.getElementById('cashTendered'))document.getElementById('cashTendered').value='0';
                if(document.getElementById('paymentMethod'))document.getElementById('paymentMethod').value='CASH';
                updateChange();renderCart();showToast(splitBills[splitCurrentIndex].name+' siap dibayar.');return;
            }
            splitBills=null;splitCurrentIndex=0;splitCustomerName='';showToast('Semua bill selesai dibayar.');
        }
        cart=[];
        document.getElementById('cartDiscount').value='0';
        document.getElementById('customerName').value='';
        if(document.getElementById('cashTendered'))document.getElementById('cashTendered').value='0';
        if(document.getElementById('paymentMethod'))document.getElementById('paymentMethod').value='CASH';
        updateChange();renderCart();
        
    } catch(e){ console.error('checkoutOrder error:', e); alert('⚠️ Error checkout: '+e.message); }
}

// ============================================================
// RECEIPT
// ============================================================
function formatVarianDetail(detail){ if(!detail)return ''; var match=detail.match(/Pack isi (\d+)/); if(match) return 'isi '+match[1]; if(detail.indexOf('Pack')!==-1 && detail.indexOf('Pack isi')===-1) return ''; if(detail.indexOf('Pcs')!==-1) return ''; return ''; }

function showCombinedReceipt(orderId, logsList, totalDiscount, grandTotal, customerName, isDuplicate, feeSummary){
    try {
        feeSummary=feeSummary||{tax:logsList.reduce(function(s,l){return s+Number(l.taxAmount||0)},0),service:logsList.reduce(function(s,l){return s+Number(l.serviceChargeAmount||0)},0),taxRate:logsList[0]?Number(logsList[0].taxRate||0):0,serviceRate:logsList[0]?Number(logsList[0].serviceChargeRate||0):0};
        lastReceiptOrder={orderId:orderId, logsList:logsList, totalDiscount:totalDiscount, grandTotal:grandTotal, customerName:customerName, isDuplicate:isDuplicate, feeSummary:feeSummary};
        var modal=document.getElementById('receiptModal');
        var body=document.getElementById('receiptBody');
        var kasir=currentUserRole==='admin'?'Admin':'Kasir';
        var displayDate=formatDisplayDate(logsList[0]?logsList[0].date:new Date());
        var name=customerName||'-';
        var s=appSettings;
        var html='<div style="padding:0;">';
        var receiptCtx=getTenantContext();html+='<div class="receipt-title">'+(receiptCtx.tenantName||'JAGOPOS.ID')+'</div>';
        html+='<div class="receipt-subtitle">'+(s.addressText||'POS & INVENTORY')+'</div>';
        if(s.showSlogan) html+='<div class="receipt-slogan">'+s.sloganText+'</div>';
        html+='<div class="receipt-divider"></div>';
        html+='<div class="receipt-info"><span>Order: '+orderId+'</span><span>Kasir: '+kasir+'</span></div>';
        html+='<div class="receipt-info"><span>Pelanggan: '+name+'</span><span>'+displayDate+'</span></div>';
        html+='<div class="receipt-divider"></div>';
        html+='<div style="display:flex;font-weight:bold;font-size:0.8rem;color:#333;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:4px;">';
        html+='<span style="flex:2;">Item</span><span style="flex:1;text-align:right;">Qty</span><span style="flex:1;text-align:right;">Harga</span><span style="flex:1;text-align:right;">Subtotal</span></div>';
        var subDisplay=0;
        logsList.forEach(function(log){
            if(log.type!=='JUAL'){ html+='<div style="display:flex;font-size:0.85rem;padding:4px 0;color:#888;"><span style="flex:2;">'+log.productName+'</span><span style="flex:3;text-align:right;">'+log.detail+'</span></div>'; return; }
            var satuan=log.grossPrice/log.qtyInput; subDisplay+=log.grossPrice;
            var varianText=formatVarianDetail(log.detail);
            var itemDisplay=log.productName+(varianText?' ('+varianText+')':'');
            html+='<div style="display:flex;font-size:0.85rem;padding:4px 0;"><span style="flex:2;">'+itemDisplay+'</span><span style="flex:1;text-align:right;">'+log.qtyInput+'</span><span style="flex:1;text-align:right;">'+formatRupiah(satuan)+'</span><span style="flex:1;text-align:right;">'+formatRupiah(log.grossPrice)+'</span></div>';
        });
        html+='<div class="receipt-divider"></div>';
        if(totalDiscount>0){ html+='<div style="display:flex;justify-content:space-between;font-size:0.9rem;"><span>Subtotal</span><span>'+formatRupiah(subDisplay)+'</span></div>'; html+='<div style="display:flex;justify-content:space-between;font-size:0.9rem;color:#ff4d4d;"><span>Diskon</span><span>-'+formatRupiah(totalDiscount)+'</span></div>'; html+='<div class="receipt-divider"></div>'; }
        if(Number(feeSummary.tax||0)>0) html+='<div style="display:flex;justify-content:space-between;font-size:0.9rem;"><span>Pajak ('+feeSummary.taxRate+'%)</span><span>'+formatRupiah(feeSummary.tax)+'</span></div>';
        if(Number(feeSummary.service||0)>0) html+='<div style="display:flex;justify-content:space-between;font-size:0.9rem;"><span>Service Charge ('+feeSummary.serviceRate+'%)</span><span>'+formatRupiah(feeSummary.service)+'</span></div>';
        html+='<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:1.2rem;color:#d4af37;"><span>TOTAL BAYAR</span><span>'+formatRupiah(grandTotal)+'</span></div>';
        if(s.showFooter) html+='<div class="footer-text">'+s.footerText+'</div>';
        if(s.showWA) html+='<div class="footer-text" style="border-top:none;padding-top:0;">'+s.waText+'</div>';
        if(s.showAddress) html+='<div class="footer-text" style="border-top:none;padding-top:0;font-size:0.7rem;">'+s.addressText+'</div>';
        if(isDuplicate && s.showDuplicate) html+='<div class="duplicate-watermark">*** DUPLICATE ***</div>';
        html+='</div>';
        body.innerHTML=html;
        modal.classList.add('active');
    } catch(e){ console.error('showCombinedReceipt error:', e); alert('⚠️ Error tampilkan struk: '+e.message); }
}
function closeReceipt(){ document.getElementById('receiptModal').classList.remove('active'); }

function generatePlainReceipt(orderId, logsList, totalDiscount, grandTotal, customerName, isDuplicate, feeSummary){
    try {
        var displayDate=formatDisplayDate(logsList[0]?logsList[0].date:new Date());
        var name=customerName||'-';
        feeSummary=feeSummary||{tax:logsList.reduce(function(s,l){return s+Number(l.taxAmount||0)},0),service:logsList.reduce(function(s,l){return s+Number(l.serviceChargeAmount||0)},0),taxRate:logsList[0]?Number(logsList[0].taxRate||0):0,serviceRate:logsList[0]?Number(logsList[0].serviceChargeRate||0):0};
        var lines=[]; var W=24; var Q=5; var P=12; var SEP=''.padEnd(W+Q+P+2,'-');
        lines.push('MANTUL KITCHEN'); lines.push('===================='); lines.push('Pelanggan : '+name); lines.push('Order ID  : '+orderId); lines.push('Tgl       : '+displayDate); lines.push('--------------------');
        var sub=0;
        logsList.forEach(function(log){
            if(log.type!=='JUAL'){ lines.push(log.productName+' '+log.detail); return; }
            sub+=log.grossPrice;
            var itemName=log.productName; var varian=formatVarianDetail(log.detail); if(varian) itemName=itemName+' ('+varian+')';
            if(itemName.length>W) itemName=itemName.substring(0,W-3)+'..';
            lines.push(itemName.padEnd(W)+log.qtyInput.toString().padStart(Q)+log.grossPrice.toLocaleString('id-ID').padStart(P));
        });
        lines.push(SEP);
        if(totalDiscount>0){ lines.push('Subtotal'.padEnd(W+Q-8)+sub.toLocaleString('id-ID').padStart(P)); lines.push('Diskon'.padEnd(W+Q-6)+'-'+totalDiscount.toLocaleString('id-ID').padStart(P)); lines.push('--------------------'); }
        if(Number(feeSummary.tax||0)>0)lines.push(('Pajak ('+feeSummary.taxRate+'%)').padEnd(W+Q-8)+Number(feeSummary.tax).toLocaleString('id-ID').padStart(P));if(Number(feeSummary.service||0)>0)lines.push(('Service ('+feeSummary.serviceRate+'%)').padEnd(W+Q-8)+Number(feeSummary.service).toLocaleString('id-ID').padStart(P));
        lines.push('TOTAL BAYAR'.padEnd(W+Q-10)+grandTotal.toLocaleString('id-ID').padStart(P));
        lines.push('====================');
        if(appSettings.showFooter) lines.push(appSettings.footerText);
        if(appSettings.showWA) lines.push(appSettings.waText);
        if(appSettings.showAddress) lines.push(appSettings.addressText);
        if(isDuplicate && appSettings.showDuplicate) lines.push('*** DUPLICATE ***');
        return lines.join('\n');
    } catch(e){ console.error('generatePlainReceipt error:', e); return 'Error generating receipt'; }
}
function copyReceipt(){ if(!lastReceiptOrder)return; var text=generatePlainReceipt(lastReceiptOrder.orderId, lastReceiptOrder.logsList, lastReceiptOrder.totalDiscount, lastReceiptOrder.grandTotal, lastReceiptOrder.customerName, lastReceiptOrder.isDuplicate, lastReceiptOrder.feeSummary); navigator.clipboard.writeText(text).then(function(){ alert('✅ Teks disalin!'); }); }
function sendReceiptWA(){ if(!lastReceiptOrder)return; var text=generatePlainReceipt(lastReceiptOrder.orderId, lastReceiptOrder.logsList, lastReceiptOrder.totalDiscount, lastReceiptOrder.grandTotal, lastReceiptOrder.customerName, lastReceiptOrder.isDuplicate, lastReceiptOrder.feeSummary); window.open('https://wa.me/62881025532438?text='+encodeURIComponent(text),'_blank'); }
function shareReceiptImage(){ if(!lastReceiptOrder)return; showLoading('🖼️ Generating Image...'); var el=document.getElementById('receiptBody'); html2canvas(el,{scale:2,backgroundColor:'#ffffff',allowTaint:false,useCORS:true}).then(function(canvas){ hideLoading(); canvas.toBlob(function(blob){ var file=new File([blob],'Struk_'+lastReceiptOrder.orderId+'.png',{type:'image/png'}); if(navigator.share&&navigator.canShare({files:[file]})){ navigator.share({title:'Struk MANTUL KITCHEN',files:[file]}).catch(function(){}); } else { var link=document.createElement('a'); link.download='Struk_'+lastReceiptOrder.orderId+'.png'; link.href=URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href); alert('✅ Gambar didownload!'); } }); }).catch(function(err){ hideLoading(); alert('Gagal: '+err); }); }
function downloadReceiptPDF(){ if(!lastReceiptOrder)return; showLoading('📄 Generating PDF...'); var el=document.getElementById('receiptBody'); html2canvas(el,{scale:2,backgroundColor:'#ffffff',allowTaint:false,useCORS:true}).then(function(canvas){ hideLoading(); var imgData=canvas.toDataURL('image/png'); var pdf = new jsPDF('p','mm','a6'); var pdfWidth=pdf.internal.pageSize.getWidth(); var pdfHeight=(canvas.height*pdfWidth)/canvas.width; pdf.addImage(imgData,'PNG',0,0,pdfWidth,pdfHeight); pdf.save('Struk_'+lastReceiptOrder.orderId+'.pdf'); }).catch(function(err){ hideLoading(); alert('Gagal PDF: '+err); }); }

// ============================================================
// SEARCH & DELETE
// ============================================================
function searchReceipt(){
    try {
        var keyword = document.getElementById('searchReceipt').value.trim().toLowerCase();
        var auditBody = document.getElementById('auditTableBody');
        auditBody.innerHTML = '';
        
        // Gunakan seluruh logs jika keyword kosong, atau filter jika ada keyword
        var displayList = logs;
        if (keyword !== '') {
            displayList = logs.filter(function(l){ 
                var oid = (l.orderId || '').toLowerCase(); 
                var cust = (l.customerName || '').toLowerCase(); 
                var pname = (l.productName || l.product || '').toLowerCase(); 
                return oid.indexOf(keyword) !== -1 || cust.indexOf(keyword) !== -1 || pname.indexOf(keyword) !== -1; 
            });
        }
        var statusFilter = (document.getElementById('journalStatusFilter') || {}).value || '';
        if(statusFilter) displayList = displayList.filter(function(l){ return l.type === statusFilter || (statusFilter === 'PARTIAL_REFUND' && l.refundStatus === 'PARTIAL_REFUND'); });
        
        if(displayList.length === 0){ 
            auditBody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);">Tidak ditemukan transaksi.</td></tr>'; 
            return; 
        }
        
        var isAdmin = (currentUserRole === 'admin');
        var canRefund = (currentUserRole === 'admin' || currentUserRole === 'supervisor');
        displayList.forEach(function(log, i){
            var badge = log.type === 'JUAL' ? '<span class="badge-out">JUAL</span>' : log.type === 'REFUNDED' ? '<span class="badge-in">REFUND</span>' : log.type === 'TESTER' ? '<span class="badge-tester">TESTER</span>' : '<span class="badge-in">MASUK</span>';
            var dt = formatDisplayDate(log.date); 
            var oid = log.orderId || 'N/A'; 
            var cust = log.customerName || '-';
            var discHtml = '-';
            
            if(log.type === 'JUAL' && isAdmin){ 
                discHtml = '<input type="number" value="'+log.discount+'" onblur="updateManualDiscount(this,'+i+')" style="width:75px;background:var(--input);color:var(--text);border:1px solid var(--border);border-radius:5px;padding:4px;">'; 
            } else if(log.type === 'JUAL'){ 
                discHtml = formatRupiah(log.discount); 
            }
            
            var reprintBtn = (log.type === 'JUAL' || log.type === 'TESTER') ? '<button class="btn btn-secondary" style="padding:4px 8px;font-size:0.7rem;width:auto;" onclick="reprintReceipt(\''+oid+'\')">🔄 Cetak</button>' : '-';
            var deleteBtn = (isAdmin && (log.type === 'JUAL' || log.type === 'TESTER' || log.type === 'MASUK')) ? '<button class="btn btn-delete" onclick="deleteTransaction(\''+oid+'\')">🗑️</button>' : '-';
            var refundBtn = (canRefund && log.type === 'JUAL' && log.refundStatus !== 'REFUNDED') ? '<button class="btn btn-secondary btn-refund" title="Pilih item dan qty untuk refund" onclick="openPartialRefund(\''+oid+'\')">↩ Refund</button>' : (log.type === 'REFUNDED' ? '<span class="refund-done">Sudah Refund</span>' : (log.refundStatus === 'PARTIAL_REFUND' ? '<span class="refund-partial">Parsial</span>' : ''));
            
            auditBody.innerHTML += '<tr><td><small>'+oid+'</small></td><td><small>'+dt+'</small></td><td><small>'+cust+'</small></td><td><b>'+(log.productName || log.product)+'</b><br><small style="color:var(--muted)">'+log.detail+'</small></td><td>'+badge+'</td><td>'+(log.type==='JUAL'?formatRupiah(log.grossPrice):(log.type==='TESTER'?'PROMOSI':'-'))+'</td><td>'+discHtml+'</td><td><span style="color:var(--danger)">'+(log.type==='JUAL'||log.type==='TESTER'?formatRupiah(log.cogsTotal):'-')+'</span></td><td><b style="'+(log.netProfit<0?'color:var(--danger)':'color:var(--success)')+'">'+(log.type==='JUAL'||log.type==='TESTER'?formatRupiah(log.netProfit):'-')+'</b></td><td>'+reprintBtn+' '+refundBtn+' '+deleteBtn+'</td></tr>';
        });
    } catch(e){ console.error('searchReceipt error:', e); }
}
async function refundOrder(orderId){
    try {
        if(currentUserRole!=='admin' && currentUserRole!=='supervisor')return showToast('Refund membutuhkan akses Admin atau Supervisor.',true);
        var related=logs.filter(function(l){return l.orderId===orderId && l.type==='JUAL' && l.refundStatus!=='REFUNDED';});
        if(!related.length)return showToast('Order tidak tersedia untuk refund atau sudah pernah direfund.',true);
        var total=related.reduce(function(s,l){return s+Number(l.finalNominal||l.grossPrice||0)},0),qty=related.reduce(function(s,l){return s+Number(l.finalDeduct||l.qtyInput||0)},0);
        if(!(await requestSensitiveApproval('refund order '+orderId)))return;
        if(!(await jagoConfirm('Konfirmasi Refund','Kembalikan seluruh order '+orderId+' sebesar '+formatRupiah(total)+' dan restock '+qty+' Pcs?')))return;
        var refundDate=generateFormattedDate();
        related.forEach(function(l){var restockQty=Number(l.finalDeduct||l.qtyInput||0);inventory[l.sku]=Number(inventory[l.sku]||0)+restockQty;l.refundStatus='REFUNDED';l.originalType='JUAL';l.type='REFUNDED';l.refundDate=refundDate;logs.unshift({orderId:'RET-'+Date.now().toString().slice(-8)+'-'+String(l.sku||'').slice(-5),date:refundDate,sku:l.sku,product:l.product||l.productName,productName:l.productName||l.product, type:'KEMBALI',qtyInput:restockQty,detail:'Refund order '+orderId+' · '+restockQty+' Pcs',impactStock:'Masuk '+restockQty+' Pcs (Refund)',finalDeduct:0,grossPrice:0,discount:0,cogsTotal:0,finalNominal:0,netProfit:0,customerName:l.customerName||'-',unit:l.unit||'Pcs',relatedOrderId:orderId});});
        saveToCloud();renderDashboard();renderMutasi();renderRevenue();renderSOH();searchReceipt();showToast('Refund '+orderId+' berhasil. Stok dikembalikan '+qty+' Pcs.');
    }catch(e){console.error('refundOrder error:',e);showToast(e.message,true);}
}
var partialRefundOrderId='';
function getRefundableLines(orderId){return logs.filter(function(l){var baseQty=Number(l.originalFinalDeduct||l.finalDeduct||l.qtyInput||0),already=Number(l.refundedQty||0);return l.orderId===orderId&&l.type==='JUAL'&&baseQty>already;});}
function closePartialRefund(){var modal=document.getElementById('partialRefundModal');if(modal)modal.classList.remove('open');partialRefundOrderId='';}
function partialRefundPreview(){var body=document.getElementById('partialRefundBody');if(!body)return;var total=0,qty=0;body.querySelectorAll('input[data-refund-index]').forEach(function(input){var line=logs[Number(input.dataset.refundIndex)],baseQty=Number(line.originalFinalDeduct||line.finalDeduct||line.qtyInput||0),already=Number(line.refundedQty||0),available=Math.max(0,baseQty-already),requested=Math.max(0,Math.min(available,parseInt(input.value)||0));input.value=requested;qty+=requested;var lineAmount=Number(line.finalNominal||line.grossPrice||0),unitAmount=baseQty?lineAmount/baseQty:0;total+=unitAmount*requested;var maxLabel=document.getElementById('refundAvailable'+input.dataset.refundIndex);if(maxLabel)maxLabel.textContent=available;});var qtyEl=document.getElementById('partialRefundQty'),totalEl=document.getElementById('partialRefundTotal');if(qtyEl)qtyEl.textContent=qty+' Pcs';if(totalEl)totalEl.textContent=formatRupiah(total);}
function openPartialRefund(orderId){if(currentUserRole!=='admin'&&currentUserRole!=='supervisor')return showToast('Refund membutuhkan akses Admin atau Supervisor.',true);var lines=getRefundableLines(orderId);if(!lines.length)return showToast('Tidak ada item tersisa untuk direfund.',true);partialRefundOrderId=orderId;var body=document.getElementById('partialRefundBody');if(!body)return;body.innerHTML='<table class="partial-refund-table"><thead><tr><th>Produk</th><th>Terjual</th><th>Sisa Refund</th><th>Refund Qty</th></tr></thead><tbody>'+lines.map(function(line){var idx=logs.indexOf(line),baseQty=Number(line.originalFinalDeduct||line.finalDeduct||line.qtyInput||0),already=Number(line.refundedQty||0),available=Math.max(0,baseQty-already);return '<tr><td><strong>'+escapeHtml_(line.productName||line.product||line.sku)+'</strong><br><small>'+escapeHtml_(line.detail||'')+'</small></td><td>'+baseQty+'</td><td><span id="refundAvailable'+idx+'">'+available+'</span></td><td><input type="number" min="0" max="'+available+'" value="0" data-refund-index="'+idx+'" oninput="partialRefundPreview()"></td></tr>';}).join('')+'</tbody></table>';document.getElementById('partialRefundModal').classList.add('open');partialRefundPreview();}
async function submitPartialRefund(){try{if(!partialRefundOrderId)return;var lines=getRefundableLines(partialRefundOrderId),selected=[];document.querySelectorAll('#partialRefundBody input[data-refund-index]').forEach(function(input){var line=logs[Number(input.dataset.refundIndex)],baseQty=Number(line.originalFinalDeduct||line.finalDeduct||line.qtyInput||0),already=Number(line.refundedQty||0),available=Math.max(0,baseQty-already),requested=Math.max(0,Math.min(available,parseInt(input.value)||0));if(requested)selected.push({line:line,qty:requested,baseQty:baseQty});});if(!selected.length)return showToast('Pilih minimal satu qty untuk refund.',true);var total=selected.reduce(function(s,item){var amount=Number(item.line.finalNominal||item.line.grossPrice||0);return s+(item.baseQty?amount/item.baseQty:0)*item.qty;},0),qty=selected.reduce(function(s,item){return s+item.qty;},0);if(!(await requestSensitiveApproval('refund parsial '+partialRefundOrderId)))return;if(!(await jagoConfirm('Konfirmasi Refund Parsial','Kembalikan '+qty+' Pcs dari order '+partialRefundOrderId+' sebesar '+formatRupiah(total)+'?')))return;var refundDate=generateFormattedDate();selected.forEach(function(item,index){var l=item.line,q=item.qty,base=item.baseQty; l.originalFinalDeduct=Number(l.originalFinalDeduct||base); var oldGross=Number(l.grossPrice||0),oldCogs=Number(l.cogsTotal||0),oldFinal=Number(l.finalNominal||0),oldDiscount=Number(l.discount||0),unitGross=base?oldGross/base:0,unitCogs=base?oldCogs/base:0,unitFinal=base?oldFinal/base:0,unitDiscount=base?oldDiscount/base:0;inventory[l.sku]=Number(inventory[l.sku]||0)+q;l.refundedQty=Number(l.refundedQty||0)+q;l.grossPrice=Math.max(0,oldGross-unitGross*q);l.cogsTotal=Math.max(0,oldCogs-unitCogs*q);l.finalNominal=Math.max(0,oldFinal-unitFinal*q);l.discount=Math.max(0,oldDiscount-unitDiscount*q);l.finalDeduct=Math.max(0,base-l.refundedQty);l.netProfit=l.finalNominal-l.cogsTotal;l.refundStatus=l.refundedQty>=base?'REFUNDED':'PARTIAL_REFUND';if(l.refundStatus==='REFUNDED'){l.type='REFUNDED';}l.refundDate=refundDate;l.refundHistory=(l.refundHistory||[]).concat([{qty:q,date:refundDate,amount:unitFinal*q}]);logs.unshift({orderId:'RET-'+Date.now().toString().slice(-8)+'-'+index,date:refundDate,sku:l.sku,product:l.product||l.productName,productName:l.productName||l.product,type:'KEMBALI',qtyInput:q,detail:'Refund '+q+' Pcs dari order '+partialRefundOrderId,impactStock:'Masuk '+q+' Pcs (Refund)',finalDeduct:0,grossPrice:0,discount:0,cogsTotal:0,finalNominal:0,netProfit:0,customerName:l.customerName||'-',unit:l.unit||'Pcs',relatedOrderId:partialRefundOrderId,refundAmount:unitFinal*q});});closePartialRefund();saveToCloud();renderDashboard();renderMutasi();renderRevenue();renderSOH();searchReceipt();showToast('Refund parsial berhasil · '+qty+' Pcs · '+formatRupiah(total));}catch(e){console.error('submitPartialRefund error:',e);showToast(e.message,true);}}
function deleteTransaction(orderId){
    try {
        if(currentUserRole!=='admin')return alert('Akses ditolak!');
        if(!orderId)return;
        var related=logs.filter(function(l){ return l.orderId===orderId; });
        if(related.length===0)return alert('Transaksi tidak ditemukan!');
        if(!confirm('Hapus ORDER '+orderId+' ('+related.length+' item)? Stok akan dikembalikan.')) return;
        for(var i=0;i<related.length;i++){ var l=related[i]; if(l.type==='MASUK') inventory[l.sku]-=l.qtyInput; else if(l.type==='JUAL'||l.type==='TESTER') inventory[l.sku]+=l.finalDeduct; }
        logs=logs.filter(function(l){ return l.orderId!==orderId; });
        saveToCloud();
        renderDashboard(); renderMutasi(); renderRevenue(); renderSOH();
        alert('✅ Order '+orderId+' berhasil dihapus!');
    } catch(e){ console.error('deleteTransaction error:', e); alert('⚠️ Error: '+e.message); }
}
function reprintReceipt(orderId){
    try {
        var related=logs.filter(function(l){ return l.orderId===orderId; });
        if(related.length===0)return alert('Transaksi tidak ditemukan!');
        var totalDiscount=related.reduce(function(s,l){ return s+(l.discount||0); },0);
        var grandTotal=related.reduce(function(s,l){ return s+(l.finalNominal||0); },0);
        var customerName=related[0]?related[0].customerName:'-';
        showCombinedReceipt(orderId, related, totalDiscount, grandTotal, customerName, true);
    } catch(e){ console.error('reprintReceipt error:', e); alert('⚠️ Error: '+e.message); }
}

// ============================================================
// ADMIN TOOLS
// ============================================================
function recalculateStock(){
    try {
        if(currentUserRole!=='admin')return alert('Akses ditolak!');
        if(!confirm('Hitung ulang stok dari semua transaksi (SKU-based)?')) return;
        showLoading('🔄 Menghitung ulang stok...');
        for(var key in productCatalog) inventory[key]=0;
        var sortedLogs=logs.slice().sort(function(a,b){ return parseDate(a.date)-parseDate(b.date); });
        sortedLogs.forEach(function(l){
            if(!l.sku){ for(var s in productCatalog){ if(productCatalog[s].name===l.productName||productCatalog[s].name===l.product){ l.sku=s; break; } } if(!l.sku) return; }
            if(l.type==='MASUK') inventory[l.sku]=(inventory[l.sku]||0)+(l.qtyInput||0);
            else if(l.type==='JUAL'||l.type==='TESTER') inventory[l.sku]=(inventory[l.sku]||0)-(l.finalDeduct||0);
        });
        saveToCloud();
        renderDashboard(); renderMutasi(); renderRevenue(); renderSOH();
        hideLoading();
        alert('✅ Stok berhasil disinkronkan dari '+sortedLogs.length+' transaksi!');
    } catch(e){ console.error('recalculateStock error:', e); alert('⚠️ Error: '+e.message); }
}
async function adjustStockForProduct(sku){try{if(currentUserRole!=='admin')return showToast('Akses ditolak!',true);if(!(await requestSensitiveApproval('adjustment stok')))return;var prod=productCatalog[sku]||{},name=getProductName(sku),currentStock=Number(inventory[sku]||0);var next=await jagoPrompt('Adjust Stok · '+name,'Stok saat ini '+currentStock+' Pcs. Masukkan stok akhir dalam Pcs.','','number');if(next===null)return;var newStock=Number(next);if(!isFinite(newStock)||newStock<0)return showToast('Masukkan stok akhir yang valid',true);var diff=newStock-currentStock;if(diff===0)return showToast('Stok sudah sesuai, tidak ada perubahan.');if(!await jagoConfirm('Konfirmasi Adjust Stok','Ubah '+name+' dari '+currentStock+' menjadi '+newStock+' Pcs?'))return;inventory[sku]=newStock;logs.unshift({orderId:'ADJ-'+Date.now().toString().slice(-8),date:generateFormattedDate(),sku:sku,product:name,productName:name,type:'KOREKSI',qtyInput:Math.abs(diff),detail:diff>0?'Penyesuaian +'+diff+' Pcs':'Penyesuaian '+diff+' Pcs',impactStock:diff>0?'Masuk '+diff+' Pcs (Koreksi)':'Keluar '+Math.abs(diff)+' Pcs (Koreksi)',finalDeduct:0,grossPrice:0,discount:0,cogsTotal:0,finalNominal:0,netProfit:0,customerName:'Admin (Koreksi)',unit:'Pcs'});saveToCloud();renderDashboard();renderMutasi();renderRevenue();renderSOH();if(typeof renderStock==='function')renderStock();showToast('Stok '+name+' berhasil disesuaikan.');}catch(e){console.error('adjustStockForProduct error:',e);showToast(e.message,true);}}
async function adjustStock(){try{if(currentUserRole!=='admin')return showToast('Akses ditolak!',true);if(!(await requestSensitiveApproval('adjustment stok')))return;var items=getProductList();if(items.length===0)return showToast('Tidak ada produk!',true);var selected=await jagoPrompt('Pilih Produk','Masukkan nomor produk yang akan disesuaikan. Daftar tersedia: '+items.map(function(p,idx){return (idx+1)+'. '+p.name+' ('+p.sku+') · stok '+(inventory[p.sku]||0);}).join(' | '),'','number');if(selected===null)return;var idx=parseInt(selected)-1;if(isNaN(idx)||idx<0||idx>=items.length)return showToast('Pilihan produk tidak valid',true);var prod=items[idx],currentStock=inventory[prod.sku]||0,newStock=await jagoPrompt('Stok Akhir','Stok '+prod.name+' saat ini '+currentStock+' Pcs. Masukkan stok akhir.','','number');if(newStock===null)return;var newStockNum=parseInt(newStock);if(isNaN(newStockNum)||newStockNum<0)return showToast('Masukkan angka stok yang valid',true);var diff=newStockNum-currentStock;if(diff===0)return showToast('Stok sudah sesuai, tidak ada perubahan.');if(!await jagoConfirm('Konfirmasi Adjustment','Ubah stok '+prod.name+' dari '+currentStock+' menjadi '+newStockNum+' Pcs?'))return;inventory[prod.sku]=newStockNum;var logEntry={orderId:'ADJ-'+Date.now().toString().slice(-8),date:generateFormattedDate(),sku:prod.sku,product:prod.name,type:'KOREKSI',qtyInput:Math.abs(diff),detail:diff>0?'Penyesuaian +'+diff+' Pcs':'Penyesuaian '+diff+' Pcs',impactStock:diff>0?'Masuk '+diff+' Pcs (Koreksi)':'Keluar '+Math.abs(diff)+' Pcs (Koreksi)',finalDeduct:0,grossPrice:0,discount:0,cogsTotal:0,finalNominal:0,netProfit:0,customerName:'Admin (Koreksi)',productName:prod.name};logs.unshift(logEntry);saveToCloud();renderDashboard();renderMutasi();renderRevenue();renderSOH();showToast('Stok '+prod.name+' diubah menjadi '+newStockNum+' Pcs.');}catch(e){console.error('adjustStock error:',e);showToast(e.message,true);}}

function refreshData(){ showLoading('🔄 Memperbarui Data...'); loadFromCloud().then(function(){ hideLoading(); showSyncBanner('success','✅ Data berhasil diperbarui!',false); setTimeout(dismissSyncBanner,1500); }); }

// ============================================================
// SORT & DROPDOWN
// ============================================================
function getSortedProductKeys(){
    try {
        var keys=getSkuList();
        switch(currentSortMode){
            case 'az': return keys.sort(function(a,b){ return (productCatalog[a].name||'').localeCompare(productCatalog[b].name||''); });
            case 'za': return keys.sort(function(a,b){ return (productCatalog[b].name||'').localeCompare(productCatalog[a].name||''); });
            case 'qty_asc': return keys.sort(function(a,b){ return (inventory[a]||0)-(inventory[b]||0); });
            case 'qty_desc': return keys.sort(function(a,b){ return (inventory[b]||0)-(inventory[a]||0); });
            default: return keys.sort(function(a,b){ return (productCatalog[a].name||'').localeCompare(productCatalog[b].name||''); });
        }
    } catch(e){ return []; }
}
function changeSortMode(m){ currentSortMode=m; renderDashboard(); }
function populateProductDropdown(){
    try {
        var sel=document.getElementById('prodSelect');
        sel.innerHTML='';
        var items=getProductList();
        items.forEach(function(p){ var opt=document.createElement('option'); opt.value=p.sku; opt.textContent=p.name+' ('+p.sku+')'; sel.appendChild(opt); });
        if(sel.options.length>0) sel.selectedIndex=0;
        updateItemPreview();
    } catch(e){ console.error('populateProductDropdown error:', e); }
}
function updatePackageOptions(){
    try {
        var sku=document.getElementById('prodSelect').value;
        var group=document.getElementById('packageFormGroup');
        var sel=document.getElementById('packSelect');
        var variants=getVariants(sku);
        if(variants.length<=1){ group.style.display='none'; return; }
        group.style.display='block'; sel.innerHTML='';
        variants.forEach(function(p,i){ var opt=document.createElement('option'); opt.value=i; opt.textContent=p.label; sel.appendChild(opt); });
        updateItemPreview();
    } catch(e){ console.error('updatePackageOptions error:', e); }
}
function runCalculator(){
    try {
        if(currentUserRole!=='admin')return;
        var sku=document.getElementById('prodSelect').value;
        var qty=parseInt(document.getElementById('txQty').value)||1;
        var variants=getVariants(sku);
        var isPure=(variants.length===1&&variants[0].pcsPerPack===1);
        var totalPcs=qty;
        if(!isPure&&variants.length>0){ var idx=parseInt(document.getElementById('packSelect').value)||0; var pack=variants[idx]; if(pack)totalPcs=pack.pcsPerPack*qty; }
        var bahan=totalPcs*getCogs(sku);
        var packing=parseFloat(document.getElementById('calcPack').value)||0;
        var opr=parseFloat(document.getElementById('calcOpr').value)||0;
        var mgn=parseFloat(document.getElementById('calcMargin').value)||0;
        var total=bahan+packing+opr;
        document.getElementById('calcTotalModal').innerText=formatRupiah(total);
        var ideal=total/(1-(mgn/100));
        ideal=Math.ceil(ideal/1000)*1000;
        document.getElementById('calcIdealPrice').innerText=formatRupiah(ideal);
    } catch(e){ console.error('runCalculator error:', e); }
}

// ============================================================
// LOAD FROM CLOUD (FIX MERGE LOGS MULTI-ITEM & ANTI-DUPLIKAT)
// ============================================================
async function loadFromCloud(){
    try {
        showLoading('🔄 Menyelaraskan Data...');
        var ctx=getTenantContext();
        var readUrl=CLOUD_URL+'?tenantId='+encodeURIComponent(ctx.tenantId)+'&branchId='+encodeURIComponent(ctx.branchId)+'&userId='+encodeURIComponent(ctx.userId)+'&role='+encodeURIComponent(ctx.role)+'&sessionToken='+encodeURIComponent(ctx.sessionToken||'');
        var res = await fetch(readUrl);
        if (!res.ok) throw new Error('HTTP '+res.status+' - Gagal fetch data');
        var data = await res.json();
        var tenantKeyNow=ctx.tenantId+'::'+ctx.branchId;
        var tenantChanged=window._mantulLoadedTenantKey && window._mantulLoadedTenantKey!==tenantKeyNow;
        if(tenantChanged){inventory={};logs=[];productCatalog={};saveProductCatalog();}
        window._mantulLoadedTenantKey=tenantKeyNow;
        inventory=data.inventory||{};
        
        // FITUR MERGE LOGS ANTI-DUPLIKAT & ANTI-TERPOTONG
        if (data.logs && data.logs.length > 0) {
            var cloudLogs = data.logs.map(function(l){ 
                if(!l.orderId) l.orderId = 'LEGACY-' + Date.now().toString().slice(-8);
                if(!l.customerName) l.customerName = '-';
                if(!l.productName) l.productName = l.product || '-';
                return l;
            });
            
            var logMap = {};
            
            // 1. Masukkan data dari cloud terlebih dahulu
            cloudLogs.forEach(function(l){ 
                // Kunci unik: Order ID + SKU + Detail (Dijamin unik per item dalam 1 order)
                var uniqueKey = (l.orderId || 'ORD') + '_' + (l.sku || 'SKU') + '_' + (l.detail || ''); 
                logMap[uniqueKey] = l; 
            });
            
            // 2. Timpa dengan data lokal (jika ada transaksi baru di sesi browser ini)
            logs.forEach(function(l){ 
                var uniqueKey = (l.orderId || 'ORD') + '_' + (l.sku || 'SKU') + '_' + (l.detail || ''); 
                logMap[uniqueKey] = l; 
            });
            
            logs = Object.values(logMap);
            // Urutkan dari yang terbaru ke terlama
            logs.sort(function(a, b){ return parseDate(b.date) - parseDate(a.date); });
        }

        if (Object.prototype.hasOwnProperty.call(data,'productCatalog')) {
            productCatalog = validateAndFixProductCatalog(data.productCatalog||{});
            saveProductCatalog();
        }
        
        if (data.appSettings) {
            appSettings = data.appSettings;
            applySettingsToUI();
        }
        
        // Sinkronisasi inventory
        for (var skuKey in inventory) {
            if (!productCatalog[skuKey]) {
                productCatalog[skuKey] = {
                    sku: skuKey,
                    name: FALLBACK_PRODUCT_NAMES[skuKey] || 'Produk Legacy ('+skuKey+')',
                    cogs: 0,
                    variants: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
            }
        }
        
        populateProductDropdown();
        updatePackageOptions();
        renderDashboard();
        renderMutasi();
        renderRevenue();
        renderSOH();
        hideLoading();
        applyDateFilter(currentPeriod || 'today');
        showSyncBanner('success','✅ Data dimuat dari Cloud.', false);
        setTimeout(dismissSyncBanner, 2000);
        
    } catch(e){
        console.error('❌ Load Cloud Error:', e);
        hideLoading();
        if (Object.keys(productCatalog).length === 0) {
            productCatalog = DEFAULT_PRODUCTS;
        }
        populateProductDropdown();
        updatePackageOptions();
        renderDashboard();
        applyDateFilter(currentPeriod || 'today');
        playBeep();
        showSyncBanner('error','⚠️ Gagal konek Cloud! (Data lokal tetap aman)',true);
    }
}
// ============================================================
// SAVE TO CLOUD (FIX LIMIT LOGS MENJADI 5000 TRANSAKSI)
// ============================================================
function saveToCloud(){
    if(isSyncing) return;
    try {
        isSyncing=true;
        showLoading('💾 Menyimpan ke Cloud...');
        collectSettingsFromUI();
        fixProductCatalogBeforeSave();
        
var ctx=getTenantContext();
        var payload = {
                type: 'SALE',
                tenantContext: ctx,
                sessionToken:ctx.sessionToken||'',
                identity: {tenantId:ctx.tenantId,branchId:ctx.branchId,userId:ctx.userId,role:ctx.role},
                inventory: inventory || {},
                logs: (logs || []).map(function(record){return stampRecordIdentity(Object.assign({},record))}),
                productCatalog: productCatalog || {},
                appSettings: appSettings || {}
            };
        
        // LIMIT DINAIKKAN KE 5000 AGAR DATA LAMA TIDAK TERPOTONG
        if(payload.logs.length > 5000){ 
            console.warn('⚠️ Logs terlalu banyak ('+payload.logs.length+'), kirim 5000 terakhir'); 
            payload.logs = payload.logs.slice(0, 5000); 
        }
        
        var success=false; var attempts=0; var lastError=null;
        var doFetch = function(){
            return new Promise(function(resolve, reject){
                var controller=new AbortController();
                var timeoutId=setTimeout(function(){ controller.abort(); }, 45000);
                fetch(CLOUD_URL, {method:'POST', mode:'no-cors', signal:controller.signal, body:JSON.stringify(payload)})
                .then(function(response){ clearTimeout(timeoutId); resolve(response); })
                .catch(function(err){ clearTimeout(timeoutId); reject(err); });
            });
        };
        
        (async function(){
            while(attempts<3 && !success){
                attempts++;
                try {
                    await doFetch();
                    success=true;
                } catch(fetchError){
                    lastError=fetchError;
                    if(attempts<3){ var waitTime=2000*attempts; await new Promise(function(r){ setTimeout(r, waitTime); }); }
                }
            }
            if(success){
                hideLoading(); renderDashboard(); saveProductCatalog(); playSyncSound(true);
                showSyncBanner('success','✅ Data berhasil tersimpan ke Cloud!',false);
                setTimeout(dismissSyncBanner,3000);
            } else {
                throw new Error('Gagal setelah 3 kali percobaan. Error: '+(lastError?lastError.message:'Unknown'));
            }
            isSyncing=false;
        })().catch(function(e){
            console.error('❌ Error saveToCloud:', e);
            hideLoading(); playSyncSound(false);
            showSyncBanner('error','❌ Gagal menyimpan! Coba lagi. (Error: '+e.message+')',true);
            isSyncing=false;
        });
    } catch(e){
        console.error('❌ Error saveToCloud:', e);
        hideLoading(); playSyncSound(false);
        showSyncBanner('error','❌ Gagal menyimpan! Coba lagi. (Error: '+e.message+')',true);
        isSyncing=false;
    }
}

// ============================================================
// UNDO & RESET
// ============================================================
async function undoLastTransaction(){
    try {
        if(currentUserRole!=='admin')return alert('Akses ditolak!');
        if(!(await requestSensitiveApproval('void atau undo transaksi')))return;
        if(logs.length===0)return alert('Belum ada transaksi.');
        var last=logs[0];
        if(!last.orderId||last.orderId.startsWith('STOCK-')||last.orderId.startsWith('TEST-')){
            if(!confirm('Batalkan '+last.productName+' ('+last.type+')?'))return;
            if(last.type==='MASUK') inventory[last.sku]-=last.qtyInput;
            else if(last.type==='TESTER') inventory[last.sku]+=last.finalDeduct;
            else inventory[last.sku]+=last.finalDeduct;
            logs.shift(); saveToCloud(); renderDashboard(); return;
        }
        var oid=last.orderId;
        var toUndo=logs.filter(function(l){ return l.orderId===oid; });
        if(!confirm('Batalkan ORDER '+oid+' ('+toUndo.length+' item)?'))return;
        for(var i=0;i<toUndo.length;i++){ var l=toUndo[i]; if(l.type==='MASUK') inventory[l.sku]-=l.qtyInput; else if(l.type==='JUAL'||l.type==='TESTER') inventory[l.sku]+=l.finalDeduct; }
        logs=logs.filter(function(l){ return l.orderId!==oid; });
        saveToCloud(); renderDashboard(); alert('✅ Order '+oid+' dibatalkan.');
    } catch(e){ console.error('undoLastTransaction error:', e); alert('⚠️ Error: '+e.message); }
}
async function resetSystemData(){ try { if(currentUserRole!=='admin')return alert('Akses ditolak!'); if(!(await requestSensitiveApproval('reset database')))return; if(prompt('Ketik 8888 untuk HAPUS SEMUA DATA:')==='8888'){ for(var k in productCatalog) inventory[k]=0; logs=[]; saveToCloud(); renderDashboard(); } } catch(e){ console.error('resetSystemData error:', e); alert('⚠️ Error: '+e.message); } }

// ============================================================
// EXPORT CSV TENANT - JURNAL PENJUALAN + STOK LENGKAP
// ============================================================
function csvTenantCell(value) {
    var text = value === null || value === undefined ? '' : String(value);
    return '"' + text.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
}
function csvTenantNumber(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
}
function csvTenantFilePart(value, fallback) {
    return String(value || fallback || 'tenant').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || fallback || 'tenant';
}
function downloadTenantCSV(csv, filename) {
    var link = document.createElement('a');
    var url = URL.createObjectURL(new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'}));
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 500);
}
function exportBackupCSV() {
    try {
        if (currentUserRole !== 'admin') return alert('Akses export hanya untuk Admin tenant.');
        showLoading('📤 Menyiapkan CSV tenant...');
        var ctx = getTenantContext();
        var tenantId = ctx.tenantId || 'TENANT';
        var branchId = ctx.branchId || 'CABANG';
        var tenantName = ctx.tenantName || tenantId;
        var stamp = new Date().toISOString().slice(0,10);
        var filePart = csvTenantFilePart(tenantId, 'TENANT') + '_' + csvTenantFilePart(branchId, 'CABANG');
        var exportedAt = new Date().toISOString();

        var journalHeader = ['TenantId','BranchId','TenantName','OrderId','Waktu','Pelanggan','SKU','Nama Produk','Varian','Aktivitas','Detail','Qty Input','Qty Keluar','Harga Satuan','Omset Kotor','Diskon','Omset Bersih','Modal HPP','Laba','UserId','Role','ExportedAt'];
        var journalRows = [journalHeader.map(csvTenantCell).join(',')];
        (logs || []).forEach(function(l) {
            var type = String(l.type || 'JUAL').toUpperCase();
            var gross = csvTenantNumber(l.grossPrice || l.finalNominal || l.omset || 0);
            var discount = csvTenantNumber(l.discount || 0);
            var net = csvTenantNumber(l.finalNominal || (gross - discount));
            var cogs = csvTenantNumber(l.cogsTotal || l.modal || 0);
            var qtyInput = csvTenantNumber(l.qtyInput || l.qty || 0);
            var qtyOut = csvTenantNumber(l.finalDeduct || (type === 'JUAL' || type === 'TESTER' ? l.qty : 0));
            var unitPrice = csvTenantNumber(l.unitPrice || l.price || l.retailPrice || 0);
            journalRows.push([
                tenantId, branchId, tenantName, l.orderId || 'N/A', l.date || '', l.customerName || '-', l.sku || '',
                l.productName || l.product || '', l.variantLabel || l.variant || '', type, l.detail || '', qtyInput, qtyOut,
                unitPrice, type === 'JUAL' ? gross : 0, discount, type === 'JUAL' ? net : 0, cogs, csvTenantNumber(l.netProfit || l.profit || 0),
                l.userId || ctx.userId || '', l.role || ctx.role || '', exportedAt
            ].map(csvTenantCell).join(','));
        });

        var stockHeader = ['TenantId','BranchId','TenantName','SKU','Nama Produk','Label Varian','Pcs per Pack','HPP per Pcs','Harga per Pack','Stok Saat Ini (Pcs)','Stok Minimum','Target Reorder','Nilai Stok HPP','Nilai Stok Retail','Status Stok','ExportedAt'];
        var stockRows = [stockHeader.map(csvTenantCell).join(',')];
        var catalog = productCatalog || {};
        Object.keys(catalog).forEach(function(sku) {
            var p = catalog[sku] || {};
            var variants = Array.isArray(p.variants) && p.variants.length ? p.variants : [{}];
            var stock = csvTenantNumber((inventory || {})[sku]);
            var minStock = csvTenantNumber(p.minStock || p.minimumStock || p.min || 0);
            var reorder = csvTenantNumber(p.reorderQty || p.targetReorder || p.reorder || 0);
            var cogs = csvTenantNumber(p.cogs || p.hpp || p.cost || 0);
            variants.forEach(function(v) {
                var pack = csvTenantNumber(v.pcsPerPack || v.pcs || v.qty || 1) || 1;
                var packPrice = csvTenantNumber(v.pricePerPack || v.price || v.retailPrice || p.price || 0);
                var status = stock <= minStock ? 'PERLU RESTOCK' : 'AMAN';
                stockRows.push([tenantId,branchId,tenantName,sku,p.name || p.productName || sku,v.label || v.labelVarian || v.name || '',pack,cogs,packPrice,stock,minStock,reorder,stock*cogs,stock*(packPrice/pack),status,exportedAt].map(csvTenantCell).join(','));
            });
        });

        downloadTenantCSV(journalRows.join('\n'), 'Jagopos_' + filePart + '_Jurnal_Penjualan_' + stamp + '.csv');
        setTimeout(function(){ downloadTenantCSV(stockRows.join('\n'), 'Jagopos_' + filePart + '_Stok_Produk_' + stamp + '.csv'); }, 250);
        hideLoading();
        showSyncBanner('success','✅ 2 CSV tenant berhasil dibuat: jurnal penjualan dan stok produk.',false);
        setTimeout(dismissSyncBanner,4000);
    } catch(e) {
        hideLoading();
        console.error('exportBackupCSV error:', e);
        alert('❌ Error Export CSV Tenant: ' + e.message);
    }
}

// ============================================================
// IMPORT CSV (RESTORE)
// ============================================================
function importBackupCSV() {
    if (currentUserRole !== 'admin') return alert('Akses ditolak!');
    
    // Safety check master data exist
    if (!productCatalog || Object.keys(productCatalog).length === 0) {
        productCatalog = DEFAULT_PRODUCTS;
        saveProductCatalog();
    }
    
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            var csvData = ev.target.result;
            if (!confirm('⚠️ Peringatan: Import CSV ini akan memuat data ke dashboard dan memperbarui Google Sheet.\nLanjutkan?')) return;
            showLoading('📥 Mengurai dan Memproses CSV...');
            try {
                var lines = csvData.split('\n').filter(function(line) { return line.trim() !== ''; });
                if (lines.length < 2) throw new Error("File CSV kosong atau tidak valid.");
                var logsParsed = [];
                for (var i = 1; i < lines.length; i++) {
                    var rowStr = lines[i].trim();
                    if (rowStr === '') continue;
                    var cols = [];
                    var inQuotes = false;
                    var currentVal = '';
                    for (var c = 0; c < rowStr.length; c++) {
                        var char = rowStr[c];
                        if (char === '"') {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            cols.push(currentVal.trim().replace(/^"|"$/g, ''));
                            currentVal = '';
                        } else {
                            currentVal += char;
                        }
                    }
                    cols.push(currentVal.trim().replace(/^"|"$/g, ''));
                    if (cols.length >= 10 && cols[0]) {
                        var orderId = cols[0];
                        var waktu = cols[1] || generateFormattedDate();
                        var pelanggan = cols[2] || '-';
                        var produk = (cols[3] || '').trim();
                        var aktivitas = cols[4] || 'JUAL';
                        var detail = cols[5] || '';
                        var omset = parseFloat(cols[6]) || 0;
                        var diskon = parseFloat(cols[7]) || 0;
                        var modal = parseFloat(cols[8]) || 0;
                        var laba = parseFloat(cols[9]) || 0;
                        var matchedSku = null;
                        
                        if (produk) {
                            for (var sKey in productCatalog) {
                                var catObj = productCatalog[sKey];
                                var catName = catObj && catObj.name ? catObj.name.trim().toLowerCase() : '';
                                if (catName === produk.toLowerCase()) {
                                    matchedSku = sKey;
                                    break;
                                }
                            }
                            if (!matchedSku) {
                                for (var sKey2 in productCatalog) {
                                    var catObj2 = productCatalog[sKey2];
                                    var catName2 = catObj2 && catObj2.name ? catObj2.name.trim().toLowerCase() : '';
                                    if (catName2 && produk.toLowerCase().indexOf(catName2) !== -1) {
                                        matchedSku = sKey2;
                                        break;
                                    }
                                }
                            }
                        }
                        
                        logsParsed.push({
                            orderId: orderId,
                            date: waktu,
                            sku: matchedSku,
                            product: produk,
                            productName: produk,
                            type: aktivitas,
                            qtyInput: 1,
                            detail: detail,
                            impactStock: aktivitas === 'JUAL' ? 'Keluar' : 'Masuk',
                            finalDeduct: 0,
                            grossPrice: omset + diskon,
                            discount: diskon,
                            cogsTotal: modal,
                            finalNominal: omset,
                            netProfit: laba,
                            customerName: pelanggan
                        });
                    }
                }
                logs = logsParsed;
                
                for (var key in productCatalog) inventory[key] = 0;
                logs.forEach(function(l) {
                    if (l.sku && inventory[l.sku] !== undefined) {
                        if (l.type === 'MASUK') {
                            inventory[l.sku] += l.qtyInput;
                        } else if (l.type === 'JUAL' || l.type === 'TESTER') {
                            var matchPcs = (l.detail || '').match(/\((\d+)\s*Pcs\)/i);
                            var pcs = matchPcs ? parseInt(matchPcs[1]) : 5;
                            inventory[l.sku] -= pcs;
                        }
                    }
                });
                
                renderDashboard();
                renderMutasi();
                renderRevenue();
                renderSOH();
                hideLoading();
                showSyncBanner('success', '✅ CSV berhasil dimuat! Menyimpan ke Google Sheet...', false);
                saveToCloud(); // Save to cloud
            } catch (err) {
                hideLoading();
                alert('❌ Gagal memproses CSV: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ============================================================
// MUTASI
// ============================================================
var mutasiFilter={period:'today', start:null, end:null, item:'', sort:'az'};
function applyMutasiFilter(mode){ 
    try { 
        var today = new Date(); var start = new Date(), end = new Date(); 
        
        if(mode === 'today'){ 
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate()); 
            end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999); 
        } 
        else if(mode === 'week'){ 
            var day = today.getDay() || 7; 
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day + 1); 
            end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (7 - day), 23, 59, 59, 999); 
        } 
        else if(mode === 'month'){ 
            start = new Date(today.getFullYear(), today.getMonth(), 1); 
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999); 
        } 
        else if(mode === 'all'){ 
            start = new Date(2000, 0, 1); 
            end = new Date(2100, 0, 1, 23, 59, 59, 999); 
        } 
        else if(mode === 'custom'){ 
            var s = document.getElementById('mutasiStartDate').value; 
            var e = document.getElementById('mutasiEndDate').value; 
            if(s) start = new Date(s); 
            if(e) { end = new Date(e); end.setHours(23, 59, 59, 999); } 
            if(!s || !e) return; 
        } 
        
        mutasiFilter.period = mode; mutasiFilter.start = start; mutasiFilter.end = end; 
        renderMutasi(); 
    } catch(e){ console.error('applyMutasiFilter error:', e); } 
}
function renderMutasi(){ try { var itemFilter=document.getElementById('mutasiSearchItem').value.trim().toLowerCase(); var sort=document.getElementById('mutasiSort').value; mutasiFilter.item=itemFilter; mutasiFilter.sort=sort; var filtered=logs.filter(function(l){ if(!mutasiFilter.start||!mutasiFilter.end) return true; var d=parseDate(l.date); return d>=mutasiFilter.start&&d<=mutasiFilter.end; }); var stockAwal={}; var logsBefore=logs.filter(function(l){ if(!mutasiFilter.start) return false; var d=parseDate(l.date); return d<mutasiFilter.start; }); logsBefore.forEach(function(l){ if(!l.sku)return; if(!stockAwal[l.sku]) stockAwal[l.sku]=0; if(l.type==='MASUK') stockAwal[l.sku]+=l.qtyInput; else if(l.type==='JUAL'||l.type==='TESTER') stockAwal[l.sku]-=l.finalDeduct; }); if(itemFilter) filtered=filtered.filter(function(l){ var name=(l.productName||l.product||'').toLowerCase(); return name.indexOf(itemFilter)!==-1; }); filtered.sort(function(a,b){ return parseDate(a.date)-parseDate(b.date); }); var report={}; var runningStock=Object.assign({},stockAwal); filtered.forEach(function(l){ if(!l.sku)return; var key=l.sku; var name=l.productName||l.product||key; var hpp=getCogs(key); var retail=getRetailPrice(key); var margin=retail-hpp; if(!report[key]){ report[key]={sku:key, item:name, retailPrice:retail, marginPerPcs:margin, awal:stockAwal[key]||0, awalNilai:(stockAwal[key]||0)*hpp, masuk:0, masukNilai:0, keluar:0, keluarNilai:0, akhir:0, akhirNilaiHPP:0, akhirNilaiRetail:0, akhirMargin:0, details:[]}; } var inQty=0,outQty=0; if(l.type==='MASUK'){ inQty=l.qtyInput; report[key].masuk+=inQty; report[key].masukNilai+=inQty*hpp; } else if(l.type==='JUAL'||l.type==='TESTER'){ outQty=l.finalDeduct; report[key].keluar+=outQty; report[key].keluarNilai+=outQty*hpp; } runningStock[key]=(runningStock[key]||0)+inQty-outQty; report[key].akhir=runningStock[key]; report[key].akhirNilaiHPP=runningStock[key]*hpp; report[key].akhirNilaiRetail=runningStock[key]*retail; report[key].akhirMargin=runningStock[key]*margin; report[key].details.push({date:l.date, inQty:inQty, outQty:outQty, running:runningStock[key], type:l.type, detail:l.detail}); }); var keys=Object.keys(report); if(sort==='az') keys.sort(function(a,b){ return report[a].item.localeCompare(report[b].item); }); else if(sort==='za') keys.sort(function(a,b){ return report[b].item.localeCompare(report[a].item); }); else if(sort==='in_desc') keys.sort(function(a,b){ return report[b].masuk-report[a].masuk; }); else if(sort==='out_desc') keys.sort(function(a,b){ return report[b].keluar-report[a].keluar; }); var tbody=document.getElementById('mutasiTableBody'); tbody.innerHTML=''; if(keys.length===0){ tbody.innerHTML='<tr><td colspan="13" style="text-align:center;color:var(--muted);">Tidak ada mutasi.</td></tr>'; } else { var totalAwal=0,totalMasuk=0,totalKeluar=0,totalAkhir=0,totalAkhirRetail=0,totalAkhirMargin=0; keys.forEach(function(key){ var r=report[key]; totalAwal+=r.awal; totalMasuk+=r.masuk; totalKeluar+=r.keluar; totalAkhir+=r.akhir; totalAkhirRetail+=r.akhirNilaiRetail; totalAkhirMargin+=r.akhirMargin; tbody.innerHTML+='<tr style="border-top:2px solid var(--gold);background:var(--gold-light);"><td><b>'+r.sku+'</b></td><td><b>'+r.item+'</b></td><td>'+r.awal+' Pcs</td><td>'+formatRupiah(r.awalNilai)+'</td><td><b>'+r.masuk+' Pcs</b></td><td>'+formatRupiah(r.masukNilai)+'</td><td><b>'+r.keluar+' Pcs</b></td><td>'+formatRupiah(r.keluarNilai)+'</td><td>'+formatRupiah(r.retailPrice)+'</td><td><b style="color:var(--gold);">'+r.akhir+' Pcs</b></td><td>'+formatRupiah(r.akhirNilaiHPP)+'</td><td style="color:var(--success);">'+formatRupiah(r.akhirNilaiRetail)+'</td><td style="color:var(--gold);">'+formatRupiah(r.akhirMargin)+'</td></tr>'; r.details.forEach(function(d){ var badge=d.type==='MASUK'?'<span class="badge-in">IN</span>':'<span class="badge-out">OUT</span>'; tbody.innerHTML+='<tr style="border-bottom:1px solid var(--border);font-size:0.8rem;color:var(--muted);"><td style="padding-left:20px;" colspan="2">↳ '+formatDisplayDate(d.date)+'</td><td></td><td></td><td>'+(d.inQty?d.inQty:'-')+'</td><td>'+(d.inQty?formatRupiah(d.inQty*getCogs(key)):'-')+'</td><td>'+(d.outQty?d.outQty:'-')+'</td><td>'+(d.outQty?formatRupiah(d.outQty*getCogs(key)):'-')+'</td><td></td><td><b>'+d.running+' Pcs</b></td><td colspan="3"></td></tr>'; }); }); tbody.innerHTML+='<tr style="border-top:3px solid var(--gold);font-weight:bold;background:var(--card);"><td colspan="2"><b>TOTAL</b></td><td>'+totalAwal+' Pcs</td><td>'+formatRupiah(totalAwal*1000)+'</td><td><b>'+totalMasuk+' Pcs</b></td><td>'+formatRupiah(totalMasuk*1000)+'</td><td><b>'+totalKeluar+' Pcs</b></td><td>'+formatRupiah(totalKeluar*1000)+'</td><td></td><td><b>'+totalAkhir+' Pcs</b></td><td>'+formatRupiah(totalAkhir*1000)+'</td><td style="color:var(--success);"><b>'+formatRupiah(totalAkhirRetail)+'</b></td><td style="color:var(--gold);"><b>'+formatRupiah(totalAkhirMargin)+'</b></td></tr>'; document.getElementById('mutasiTotalIN').innerText=totalMasuk+' Pcs'; document.getElementById('mutasiTotalOUT').innerText=totalKeluar+' Pcs'; document.getElementById('mutasiSisaStok').innerText=totalAkhir+' Pcs'; document.getElementById('mutasiTotalItem').innerText=keys.length; } } catch(e){ console.error('renderMutasi error:', e); alert('⚠️ Error render mutasi: '+e.message); } }
function exportMutasiCSV(){ try { if(currentUserRole!=='admin')return alert('Akses ditolak!'); var csv="\uFEFFSKU,Item,Awal (Pcs),Awal (Rp),Masuk (Pcs),Masuk (Rp),Keluar (Pcs),Keluar (Rp),Retail/Pcs,Akhir (Pcs),Akhir (HPP),Akhir (Retail),Margin Total\n"; var tbody=document.getElementById('mutasiTableBody'); var rows=tbody.querySelectorAll('tr'); rows.forEach(function(row){ var cols=row.querySelectorAll('td'); if(cols.length===13 && !row.querySelector('td[style*="padding-left"]')){ csv+='"'+cols[0].innerText+'","'+cols[1].innerText+'","'+cols[2].innerText+'","'+cols[3].innerText+'","'+cols[4].innerText+'","'+cols[5].innerText+'","'+cols[6].innerText+'","'+cols[7].innerText+'","'+cols[8].innerText+'","'+cols[9].innerText+'","'+cols[10].innerText+'","'+cols[11].innerText+'","'+cols[12].innerText+'"\n'; } }); var link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); link.download='Mutasi_Stok.csv'; document.body.appendChild(link); link.click(); document.body.removeChild(link); } catch(e){ console.error('exportMutasiCSV error:', e); } }

// ============================================================
// REVENUE
// ============================================================
var revenueFilter={period:'today', start:null, end:null},currentRevenueProfit=0;
function applyRevenueFilter(mode){ 
    try { 
        var today = new Date(); var start = new Date(), end = new Date(); 
        
        if(mode === 'today'){ 
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate()); 
            end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999); 
        } 
        else if(mode === 'week'){ 
            var day = today.getDay() || 7; 
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day + 1); 
            end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (7 - day), 23, 59, 59, 999); 
        } 
        else if(mode === 'month'){ 
            start = new Date(today.getFullYear(), today.getMonth(), 1); 
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999); 
        } 
        else if(mode === 'all'){ 
            start = new Date(2000, 0, 1); 
            end = new Date(2100, 0, 1, 23, 59, 59, 999); 
        } 
        else if(mode === 'custom'){ 
            var s = document.getElementById('revStartDate').value; 
            var e = document.getElementById('revEndDate').value; 
            if(s) start = new Date(s); 
            if(e) { end = new Date(e); end.setHours(23, 59, 59, 999); } 
            if(!s || !e) return; 
        } 
        
        revenueFilter.period = mode; revenueFilter.start = start; revenueFilter.end = end; 
        renderRevenue(); 
    } catch(e){ console.error('applyRevenueFilter error:', e); } 
}
function renderOperationalReport(filtered){var payment={},products={},orders={};(filtered||[]).forEach(function(l){var method=l.paymentMethod||'LAINNYA';payment[method]=(payment[method]||0)+(l.finalNominal||0);var p=l.productName||l.product||l.sku||'Produk';if(!products[p])products[p]={qty:0,net:0};products[p].qty+=(l.finalDeduct||l.qtyInput||0);products[p].net+=(l.finalNominal||0);if(l.orderId)orders[l.orderId]=true;});function rows(obj,formatter,limit){var keys=Object.keys(obj).sort(function(a,b){return formatter.sortValue(obj[b])-formatter.sortValue(obj[a]);}).slice(0,limit||5);return keys.length?keys.map(function(k){return '<div class="mini-report-row"><span>'+k+'</span><strong>'+formatter.text(obj[k])+'</strong></div>';}).join(''):'<div class="mini-report-row"><span>Belum ada data</span><strong>—</strong></div>';}var payEl=document.getElementById('paymentMethodReport'),topEl=document.getElementById('topProductReport'),perfEl=document.getElementById('performanceReport');if(payEl)payEl.innerHTML=rows(payment,{sortValue:function(v){return v;},text:function(v){return formatRupiah(v);}},5);if(topEl)topEl.innerHTML=rows(products,{sortValue:function(v){return v.qty;},text:function(v){return v.qty+' pcs · '+formatRupiah(v.net);}},5);var totalNet=(filtered||[]).reduce(function(s,l){return s+(l.finalNominal||0);},0),totalProfit=(filtered||[]).reduce(function(s,l){return s+(l.netProfit||0);},0),avg=Object.keys(orders).length?totalNet/Object.keys(orders).length:0;if(perfEl)perfEl.innerHTML='<div class="mini-report-row"><span>Jumlah order</span><strong>'+Object.keys(orders).length+'</strong></div><div class="mini-report-row"><span>Rata-rata order</span><strong>'+formatRupiah(avg)+'</strong></div><div class="mini-report-row"><span>Margin bersih</span><strong>'+formatRupiah(totalProfit)+'</strong></div>';}
async function loadExpenseReport(){var ctx=getTenantContext(),list=document.getElementById('expenseList'),summary=document.getElementById('expenseSummary');if(!ctx.sessionToken||!['admin','supervisor'].includes(String(ctx.role).toLowerCase()))return;try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'EXPENSE_LIST',sessionToken:ctx.sessionToken})});var data=await r.json();if(data.status!=='success')throw new Error(data.message||'Gagal membaca pengeluaran');var items=(data.result&&data.result.items)||[],start=revenueFilter.start?new Date(revenueFilter.start):null,end=revenueFilter.end?new Date(revenueFilter.end):null;end&&end.setHours(23,59,59,999);var filtered=items.filter(function(x){var d=new Date(x.date);return (!start||d>=start)&&(!end||d<=end);});var total=filtered.reduce(function(s,x){return s+Number(x.amount||0);},0),netProfit=currentRevenueProfit-total;if(summary)summary.textContent='Total pengeluaran periode: '+formatRupiah(total)+' · Laba bersih: '+formatRupiah(netProfit);var netEl=document.getElementById('revNetProfit');if(netEl)netEl.textContent=formatRupiah(netProfit);if(list)list.innerHTML=filtered.slice().reverse().slice(0,30).map(function(x){return '<div class="expense-row"><span>'+x.date+' · '+x.category+' · '+x.description+'</span><strong>'+formatRupiah(x.amount)+'</strong></div>';}).join('')||'<div class="expense-row"><span>Belum ada pengeluaran</span><strong>—</strong></div>';}catch(e){if(summary)summary.textContent='❌ '+e.message;}}
async function saveBusinessExpense(){var ctx=getTenantContext(),date=(document.getElementById('expenseDate')||{}).value,category=(document.getElementById('expenseCategory')||{}).value,unit=(document.getElementById('expenseUnit')||{}).value||'Pcs',qty=Number((document.getElementById('expenseQty')||{}).value||1),baseDescription=(document.getElementById('expenseDescription')||{}).value.trim(),description='['+unit+' x '+qty+'] '+baseDescription,amount=Number((document.getElementById('expenseAmount')||{}).value||0);if(!baseDescription||!isFinite(qty)||qty<=0||!amount)return alert('Lengkapi keterangan dan nominal pengeluaran');try{var r=await fetch(CLOUD_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'EXPENSE_SAVE',sessionToken:ctx.sessionToken,expense:{date:date,category:category,description:description,amount:amount}})});var data=await r.json();if(data.status!=='success')throw new Error(data.message||'Gagal menyimpan pengeluaran');document.getElementById('expenseDescription').value='';document.getElementById('expenseAmount').value='';var eq=document.getElementById('expenseQty');if(eq)eq.value='1';await loadExpenseReport();alert('✅ Pengeluaran tersimpan');}catch(e){alert('❌ '+e.message);}}
function renderRevenue(){ 
    try { 
        var filtered = logs.filter(function(l){ return l.type === 'JUAL'; }); 
        
        // Periksa apakah filter tanggal aktif
        if (revenueFilter.start && revenueFilter.end) {
            filtered = filtered.filter(function(l){ 
                var d = parseDate(l.date); 
                return d >= revenueFilter.start && d <= revenueFilter.end; 
            });
        }
        
        renderOperationalReport(filtered);
        var daily = {}; 
        filtered.forEach(function(l){ 
            var key = formatDisplayDate(l.date); 
            if(!daily[key]) daily[key] = { gross: 0, disc: 0, net: 0, hpp: 0, profit: 0 }; 
            daily[key].gross += (l.grossPrice || 0); 
            daily[key].disc += (l.discount || 0); 
            daily[key].net += (l.finalNominal || 0); 
            daily[key].hpp += (l.cogsTotal || 0); 
            daily[key].profit += (l.netProfit || 0); 
        }); 
        
        var labels = Object.keys(daily).sort(function(a,b){ return new Date(a) - new Date(b); }); 
        var dataNet = labels.map(function(k){ return daily[k].net; }); 
        var dataProfit = labels.map(function(k){ return daily[k].profit; }); 
        
        var totalGross = labels.reduce(function(a,k){ return a + daily[k].gross; }, 0); 
        var totalDisc = labels.reduce(function(a,k){ return a + daily[k].disc; }, 0); 
        var totalNet = labels.reduce(function(a,k){ return a + daily[k].net; }, 0); 
        var totalProfit = labels.reduce(function(a,k){ return a + daily[k].profit; }, 0);
        currentRevenueProfit=totalProfit;loadExpenseReport(); 
        
        document.getElementById('revGross').innerText = formatRupiah(totalGross); 
        document.getElementById('revDisc').innerText = formatRupiah(totalDisc); 
        document.getElementById('revNet').innerText = formatRupiah(totalNet); 
        document.getElementById('revProfit').innerText = formatRupiah(totalProfit); 
        
        var tbody = document.getElementById('revenueTableBody'); 
        tbody.innerHTML = ''; 
        if(labels.length === 0){ 
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);">Tidak ada data pendapatan pada periode ini.</td></tr>'; 
        } else { 
            labels.forEach(function(k){ 
                tbody.innerHTML += '<tr><td>'+k+'</td><td>'+formatRupiah(daily[k].gross)+'</td><td>'+formatRupiah(daily[k].disc)+'</td><td>'+formatRupiah(daily[k].net)+'</td><td>'+formatRupiah(daily[k].hpp)+'</td><td>'+formatRupiah(daily[k].profit)+'</td></tr>'; 
            }); 
        } 
        
        var ctx = document.getElementById('revenueChart').getContext('2d'); 
        if(revenueChartInstance) revenueChartInstance.destroy(); 
        revenueChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { 
                labels: labels, 
                datasets: [
                    { label: 'Omset Bersih', data: dataNet, backgroundColor: 'rgba(212,175,55,0.7)', borderRadius: 4 },
                    { label: 'Laba', data: dataProfit, backgroundColor: 'rgba(37,211,102,0.7)', borderRadius: 4 }
                ] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { labels: { color: '#fff' } } }, 
                scales: { y: { beginAtZero: true, grid: { color: '#2a2a2e' } }, x: { grid: { display: false }, ticks: { color: '#fff' } } } 
            } 
        }); 
    } catch(e){ console.error('renderRevenue error:', e); }
}
function exportRevenueCSV(){ try { if(currentUserRole!=='admin')return alert('Akses ditolak!'); var csv="\uFEFFTanggal,Omset Kotor,Diskon,Omset Bersih,Modal,Laba\n"; var tbody=document.getElementById('revenueTableBody'); var rows=tbody.querySelectorAll('tr'); rows.forEach(function(row){ var cols=row.querySelectorAll('td'); if(cols.length===6) csv+='"'+cols[0].innerText+'","'+cols[1].innerText+'","'+cols[2].innerText+'","'+cols[3].innerText+'","'+cols[4].innerText+'","'+cols[5].innerText+'"\n'; }); var link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); link.download='Pendapatan.csv'; document.body.appendChild(link); link.click(); document.body.removeChild(link); } catch(e){ console.error('exportRevenueCSV error:', e); } }

// ============================================================
// SOH
// ============================================================
function renderSOH(){ 
    try {
        var keyword = document.getElementById('sohSearch') ? document.getElementById('sohSearch').value.trim().toLowerCase() : '';
        var sortSelect = document.getElementById('sohSort');
        var sort = sortSelect ? sortSelect.value : 'az';
        var items = getProductList();
        
        var tbody = document.getElementById('sohTableBody');
        if(!tbody) return;
        
        if(items.length === 0){ 
            tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--muted);">Belum ada produk / stok.</td></tr>'; 
            var setTxt = function(id, val){ var el = document.getElementById(id); if(el) el.innerText = val; };
            setTxt('sohTotalValue', 'Rp 0');
            setTxt('sohTotalQty', '0 Pcs');
            setTxt('sohTotalRetail', 'Rp 0');
            setTxt('sohTotalMargin', 'Rp 0');
            return; 
        }
        
        if(keyword) items = items.filter(function(p){ return p.name.toLowerCase().indexOf(keyword) !== -1; });
        
        if(sort === 'az') items.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
        else if(sort === 'za') items.sort(function(a,b){ return (b.name||'').localeCompare(a.name||''); });
        else if(sort === 'value_desc') items.sort(function(a,b){ return ((inventory[b.sku]||0)*getCogs(b.sku)) - ((inventory[a.sku]||0)*getCogs(a.sku)); });
        else if(sort === 'qty_desc') items.sort(function(a,b){ return (inventory[b.sku]||0) - (inventory[a.sku]||0); });
        
        tbody.innerHTML=''; 
        var totalQty=0, totalNilaiHPP=0, totalNilaiRetail=0, totalMargin=0, totalItems=0;
        
        items.forEach(function(p){ 
            var sku = p.sku; 
            var qty = inventory[sku] || 0; 
            var hpp = getCogs(sku); 
            var retail = getRetailPrice(sku); 
            var margin = retail - hpp; 
            var nilaiHPP = qty * hpp; 
            var nilaiRetail = qty * retail; 
            var totalMarginItem = qty * margin; 
            
            totalQty += qty; 
            totalNilaiHPP += nilaiHPP; 
            totalNilaiRetail += nilaiRetail; 
            totalMargin += totalMarginItem; 
            if(qty > 0) totalItems++; 
            
            var statusColor = qty > 0 ? 'var(--text)' : 'var(--muted)'; 
            tbody.innerHTML += '<tr style="color:'+statusColor+';"><td><b>'+p.sku+'</b></td><td><b>'+p.name+'</b></td><td>'+qty+' Pcs</td><td>'+formatRupiah(hpp)+'</td><td>'+formatRupiah(retail)+'</td><td>'+formatRupiah(margin)+'</td><td>'+formatRupiah(nilaiHPP)+'</td><td style="color:var(--success);">'+formatRupiah(nilaiRetail)+'</td><td style="color:var(--gold);">'+formatRupiah(totalMarginItem)+'</td></tr>'; 
        });
        
        tbody.innerHTML += '<tr style="border-top:3px solid var(--gold);font-weight:bold;background:var(--card);"><td colspan="2"><b>TOTAL</b></td><td><b>'+totalQty+' Pcs</b></td><td></td><td></td><td></td><td>'+formatRupiah(totalNilaiHPP)+'</td><td style="color:var(--success);"><b>'+formatRupiah(totalNilaiRetail)+'</b></td><td style="color:var(--gold);"><b>'+formatRupiah(totalMargin)+'</b></td></tr>'; 
        
        var setTxt = function(id, val){ var el = document.getElementById(id); if(el) el.innerText = val; };
        setTxt('sohTotalValue', formatRupiah(totalNilaiHPP));
        setTxt('sohTotalQty', totalQty + ' Pcs');
        setTxt('sohTotalRetail', formatRupiah(totalNilaiRetail));
        setTxt('sohTotalMargin', formatRupiah(totalMargin));
        
    } catch(e){ 
        console.error('renderSOH error:', e); 
    }
}
function exportSOHCSV(){ try { if(currentUserRole!=='admin')return alert('Akses ditolak!'); var csv="\uFEFFSKU,Item,Stok (Pcs),HPP/Pcs,Retail/Pcs,Margin/Pcs,Nilai (HPP),Nilai (Retail),Total Margin\n"; var tbody=document.getElementById('sohTableBody'); var rows=tbody.querySelectorAll('tr'); rows.forEach(function(row){ var cols=row.querySelectorAll('td'); if(cols.length===9) csv+='"'+cols[0].innerText+'","'+cols[1].innerText+'","'+cols[2].innerText+'","'+cols[3].innerText+'","'+cols[4].innerText+'","'+cols[5].innerText+'","'+cols[6].innerText+'","'+cols[7].innerText+'","'+cols[8].innerText+'"\n'; }); var link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); link.download='SOH_Nilai.csv'; document.body.appendChild(link); link.click(); document.body.removeChild(link); } catch(e){ console.error('exportSOHCSV error:', e); } }

// ============================================================
// DASHBOARD RENDER
// ============================================================
function renderDashboard(){ 
    try {
        console.log('📊 renderDashboard dipanggil');
        var stockBody=document.getElementById('stockTableBody');
        if(!stockBody){ console.error('❌ stockTableBody tidak ditemukan!'); return; }
        stockBody.innerHTML='';
        var items=getSortedProductKeys();
        if(items.length===0){ stockBody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--muted);">Belum ada produk.</td></tr>'; } else {
            var isAdmin=currentUserRole==='admin';
            var html='';
            items.forEach(function(sku){ var name=getProductName(sku); var qty=inventory[sku]||0; var prodConfig=productCatalog[sku]||{}; var minStock=Object.prototype.hasOwnProperty.call(prodConfig,'minStock')?Number(prodConfig.minStock||0):5; var unit='Pcs'; var variants=getVariants(sku); if(variants.length===1&&variants[0].pcsPerPack===1) unit='Pack'; var fc=getForecastDays(sku)||'-'; var safe=sku.replace(/'/g,"\\'"); var actions=''; if(isAdmin){ actions='<button class="btn-edit product-edit-btn" title="Edit menu dan varian" onclick="editProduct(\''+safe+'\')">📝 Edit Menu</button><button class="btn-edit product-adjust-btn" title="Adjust stok produk" onclick="adjustStockForProduct(\''+safe+'\')">✏️ Stok</button><button class="btn-trash" title="Hapus produk" onclick="deleteProduct(\''+safe+'\')">🗑️ Hapus</button>'; } else { actions='<span style="color:var(--muted);font-size:0.7rem;">(read only)</span>'; } actions+=' <button class="btn btn-secondary" style="padding:2px 6px;font-size:0.6rem;width:auto;" onclick="goToMutation(\''+safe+'\')">🔍 Mutasi</button>'; var low=qty<=minStock;html+='<tr class="'+(low?'stock-low-row':'')+'"><td><b>'+name+'</b> <small style="color:var(--muted);">('+sku+')</small></td><td style="color:'+(low?'var(--danger)':'inherit')+';font-weight:'+(low?'700':'400')+'">'+qty+' '+unit+(low?' ⚠️':'')+'</td><td>'+minStock+' '+unit+'</td><td style="font-size:0.75rem;">'+fc+(low?' · <b style="color:var(--warning)">Reorder '+Number(prodConfig.reorderQty||20)+' '+unit+'</b>':'')+'</td><td style="text-align:center;white-space:nowrap;">'+actions+'</td></tr>'; });
            stockBody.innerHTML=html;
        }
        var tRev=0,tVol=0,tDisc=0,tGross=0,tCogs=0,tNet=0,tTrans=0;
        var audit=document.getElementById('auditTableBody');
        if(!audit)return;
        audit.innerHTML='';
        var display=filteredLogs.length>0?filteredLogs:logs;
        if(display.length===0){ audit.innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--muted);">Tidak ada transaksi.</td></tr>'; } else { var uniqueOrders=new Set(); display.forEach(function(log,i){ var badge=log.type==='JUAL'?'<span class="badge-out">JUAL</span>':log.type==='TESTER'?'<span class="badge-tester">TESTER</span>':'<span class="badge-in">MASUK</span>'; if(log.type==='JUAL'){ tRev+=log.finalNominal||0; tDisc+=log.discount||0; tVol+=log.qtyInput||0; tGross+=log.grossPrice||0; tCogs+=log.cogsTotal||0; tNet+=log.netProfit||0; uniqueOrders.add(log.orderId); } if(log.type==='TESTER'){ tCogs+=log.cogsTotal||0; tNet+=log.netProfit||0; } var dt=formatDisplayDate(log.date)||log.date; var oid=log.orderId||'N/A'; var cust=log.customerName||'-'; var pname=log.productName||log.product||'-'; var discHtml='-'; if(log.type==='JUAL'&&isAdmin){ discHtml='<input type="number" value="'+log.discount+'" onblur="updateManualDiscount(this,'+i+')" style="width:75px;background:var(--input);color:var(--text);border:1px solid var(--border);border-radius:5px;padding:4px;">'; } else if(log.type==='JUAL'){ discHtml=formatRupiah(log.discount); } var reprintBtn=(log.type==='JUAL'||log.type==='TESTER')?'<button class="btn btn-secondary" style="padding:4px 8px;font-size:0.7rem;width:auto;" onclick="reprintReceipt(\''+oid+'\')">🔄</button>':'-'; var deleteBtn=isAdmin?'<button class="btn btn-delete" onclick="deleteTransaction(\''+oid+'\')">🗑️</button>':'-'; audit.innerHTML+='<tr><td><small>'+oid+'</small></td><td><small>'+dt+'</small></td><td><small>'+cust+'</small></td><td><b>'+pname+'</b> <small style="color:var(--muted);">'+(log.sku||'')+'</small><br><small style="color:var(--muted);">'+log.detail+'</small></td><td>'+badge+'</td><td>'+(log.type==='JUAL'?formatRupiah(log.grossPrice):(log.type==='TESTER'?'PROMOSI':'-'))+'</td><td>'+discHtml+'</td><td><span style="color:var(--danger)">'+(log.type==='JUAL'||log.type==='TESTER'?formatRupiah(log.cogsTotal):'-')+'</span></td><td><b style="'+(log.netProfit<0?'color:var(--danger)':'color:var(--success)')+'">'+(log.type==='JUAL'||log.type==='TESTER'?formatRupiah(log.netProfit):'-')+'</b></td><td>'+reprintBtn+' '+deleteBtn+'</td></tr>'; }); tTrans=uniqueOrders.size; }
        document.getElementById('sumRevenue').innerText=formatRupiah(tRev);
        document.getElementById('sumSold').innerText=tVol+' Item';
        document.getElementById('sumDiscount').innerText=formatRupiah(tDisc);
        document.getElementById('sumTransaction').innerText=tTrans;
        document.getElementById('profGross').innerText=formatRupiah(tGross);
        document.getElementById('profCogs').innerText=formatRupiah(tCogs);
        document.getElementById('profNet').innerText=formatRupiah(tNet);
        document.getElementById('profCount').innerText=tTrans;
        var pareto=calculatePareto();
        var topEl=document.getElementById('topProducts');
        if(topEl){ topEl.innerHTML=pareto.top.length===0?'<p style="color:var(--muted);font-size:0.8rem;">Belum ada data.</p>':pareto.top.map(function(item){ return '<div class="pareto-item top"><span class="name">'+item[0]+'</span><span class="val">'+item[1]+' pcs</span></div>'; }).join(''); }
        var bottomEl=document.getElementById('bottomProducts');
        if(bottomEl){ bottomEl.innerHTML=pareto.bottom.length===0?'<p style="color:var(--muted);font-size:0.8rem;">Data kosong.</p>':pareto.bottom.map(function(item){ return '<div class="pareto-item bottom"><span class="name">'+item[0]+'</span><span class="val">'+item[1]+' pcs</span></div>'; }).join(''); }
        renderDashboard3();
        checkAlertsAndChart(display);
    } catch(e){ console.error('renderDashboard error:', e); alert('⚠️ Error render dashboard: '+e.message); }
}

// ============================================================
// GO TO MUTATION, UPDATE DISCOUNT, ALERTS & CHART
// ============================================================
function renderDashboard3(){try{var get=function(id){var el=document.getElementById(id);return el?el.textContent:'—';};var set=function(id,value){var el=document.getElementById(id);if(el)el.textContent=value;};set('d3Revenue',get('sumRevenue'));set('d3Profit',get('profNet'));set('d3Orders',get('sumTransaction'));var low=0;Object.keys(inventory||{}).forEach(function(sku){var prod=productCatalog[sku]||{},min=Object.prototype.hasOwnProperty.call(prod,'minStock')?Number(prod.minStock||0):5;if(Number(inventory[sku]||0)<=min)low++;});set('d3LowStock',String(low));var ctx=getTenantContext(),shift=ctx&&ctx.shiftId;set('d3ShiftStatus',shift?'Shift aktif':'Belum dibuka');set('d3StockStatus',low?low+' produk perlu restock':'Stok dalam batas aman');set('d3ExpenseStatus',currentUserRole==='admin'||currentUserRole==='supervisor'?'Tersedia di Laporan':'Akses terbatas');var badge=document.getElementById('d3HealthBadge');if(badge){badge.textContent=low?'Perlu perhatian':'Kondisi baik';badge.classList.toggle('warning',!!low);}var label=document.getElementById('d3PeriodLabel');if(label){var names={today:'Hari Ini',week:'Minggu Ini',month:'Bulan Ini',all:'All Time',custom:'Periode Pilihan'};label.textContent=names[currentPeriod]||'Hari Ini';}}catch(e){console.warn('renderDashboard3:',e);}}
function goToMutation(sku){ switchTab('mutasi'); document.getElementById('mutasiSearchItem').value=getProductName(sku); renderMutasi(); }
function updateManualDiscount(el,idx){ try { if(currentUserRole!=='admin')return alert('Akses ditolak!'); var v=parseInt(el.value.replace(/[^0-9]/g,''))||0; logs[idx].discount=v; logs[idx].finalNominal=Math.max(0,logs[idx].grossPrice-v); logs[idx].netProfit=logs[idx].finalNominal-logs[idx].cogsTotal; saveToCloud(); } catch(e){ console.error('updateManualDiscount error:', e); } }
function checkAlertsAndChart(data){ try { var box=document.getElementById('stockAlerts'); box.innerHTML=''; var lowCount=0; for(var sku in inventory){ var stok=inventory[sku]||0; var prod=productCatalog[sku]||{}; var th=Number(prod.minStock||0); if(!Object.prototype.hasOwnProperty.call(prod,'minStock')){var legacyName=getProductName(sku);th=legacyName.indexOf('Dimsum Premium')!==-1||legacyName.indexOf('Gyoza Premium')!==-1?20:(legacyName.indexOf('Wonton')!==-1?10:5);} if(stok<=th){lowCount++;var reorder=Number(prod.reorderQty||20);box.innerHTML+='<div class="alert-box">⚠️ <b>'+getProductName(sku)+'</b> menipis · Sisa '+stok+' · Reorder '+reorder+'</div>';}} if(lowCount===0)box.innerHTML='<div class="stock-ok-box">✅ Semua stok berada di atas batas minimum</div>'; var ctx=document.getElementById('salesChart').getContext('2d'); if(salesChartInstance) salesChartInstance.destroy(); var cnt={}; (data||logs).forEach(function(l){ if(l.type==='JUAL'){ var name=l.productName||l.product||'-'; if(!cnt[name])cnt[name]=0; cnt[name]+=l.qtyInput; } }); var labels=Object.keys(cnt); var values=labels.map(function(k){ return cnt[k]; }); salesChartInstance=new Chart(ctx,{type:'bar',data:{labels:labels, datasets:[{label:'Penjualan', data:values, backgroundColor:'#d4af37', borderRadius:4}]},options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, grid:{color:'#2a2a2e'}}, x:{grid:{display:false}}}} }); } catch(e){ console.error('checkAlertsAndChart error:', e); } }

// ============================================================
// LOADING & SYNC BANNER
// ============================================================
function showLoading(t){ var el=document.getElementById('syncIndicator'); el.innerText=t; el.style.display='block'; }
function hideLoading(){ document.getElementById('syncIndicator').style.display='none'; }
function playBeep(){ try{ var ctx=new(window.AudioContext||window.webkitAudioContext)(); var osc=ctx.createOscillator(); var gain=ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value=800; osc.type='square'; gain.gain.value=0.3; osc.start(); setTimeout(function(){ try{osc.stop();ctx.close();}catch(e){} },350); }catch(e){} }
function showSyncBanner(type,msg,retry){ var b=document.getElementById('syncStatusBanner'); b.className='sync-banner '+type; b.style.display='flex'; var btn=''; if(retry) btn+='<button class="btn-retry" onclick="retrySync()">🔄 Coba Lagi</button>'; btn+='<button class="btn-close" onclick="dismissSyncBanner()">✕ Tutup</button>'; b.innerHTML='<span>'+msg+'</span> <div style="display:flex;gap:8px;">'+btn+'</div>'; }
function dismissSyncBanner(){ document.getElementById('syncStatusBanner').style.display='none'; }
function retrySync(){ dismissSyncBanner(); saveToCloud(); }

// ============================================================
// INIT APP
// ============================================================
async function initApp(){ 
    try{ 
        console.log('🚀 initApp dimulai');
        loadProductCatalog();
        if (productCatalog && Object.keys(productCatalog).length > 0) {
            productCatalog = validateAndFixProductCatalog(productCatalog);
            saveProductCatalog();
        }
        await loadFromCloud(); 
        populateProductDropdown(); 
        updatePackageOptions(); 
        renderDashboard(); 
        renderCart(); 
        applyRoleUI(); 
        console.log('✅ initApp selesai');
    } catch(e){ 
        console.error('❌ Error initApp:', e);
        alert('⚠️ Terjadi error saat inisialisasi aplikasi:\n' + e.message + '\n\nCoba refresh halaman atau hubungi admin.');
    } 
}
var auditFilter = { start: null, end: null };

function applyAuditFilter(mode){
    try {
        // Atur tombol aktif di UI
        // Opsional: jika ada tombol filter di tab profit, sesuaikan class active-nya
        var today = new Date(); var start = new Date(), end = new Date();
        
        if(mode === 'today'){ 
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate()); 
            end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59); 
        }
        else if(mode === 'week'){ 
            var day = today.getDay() || 7; 
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day + 1); 
            end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (7 - day), 23, 59, 59); 
        }
        else if(mode === 'month'){ 
            start = new Date(today.getFullYear(), today.getMonth(), 1); 
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59); 
        }
        else if(mode === 'all'){ 
            start = new Date(2000, 0, 1); 
            end = new Date(2100, 0, 1, 23, 59, 59); 
        }
        else if(mode === 'custom'){ 
            var s = document.getElementById('auditStartDate').value; 
            var e = document.getElementById('auditEndDate').value; 
            if(s) start = new Date(s); 
            if(e) {
                end = new Date(e);
                end.setHours(23, 59, 59, 999); // Set ke akhir hari
            }
            if(!s || !e) return; 
        }
        
        auditFilter.start = start; 
        auditFilter.end = end;
        
        // Filter logs berdasarkan rentang tanggal audit
        filteredLogs = logs.filter(function(l){
            var d = parseDate(l.date);
            return d >= auditFilter.start && d <= auditFilter.end;
        });
        
        // Render ulang rekapitulasi angka di tab Jurnal (Profit)
        renderAuditSummary(filteredLogs);
        
        // Render tabel data jurnal
        searchReceipt();
    } catch(e){ 
        console.error('applyAuditFilter error:', e); 
    }
}

// Fungsi untuk menghitung dan menampilkan rekap ringkasan di atas tabel Jurnal
function renderAuditSummary(dataList) {
    try {
        var tGross = 0, tCogs = 0, tNet = 0;
        var uniqueOrders = new Set();
        
        dataList.forEach(function(l){
            if(l.type === 'JUAL'){
                tGross += (l.grossPrice || 0);
                tCogs += (l.cogsTotal || 0);
                tNet += (l.netProfit || 0);
                uniqueOrders.add(l.orderId);
            } else if(l.type === 'TESTER'){
                tCogs += (l.cogsTotal || 0);
                tNet += (l.netProfit || 0);
            }
        });
        
        document.getElementById('profGross').innerText = formatRupiah(tGross);
        document.getElementById('profCogs').innerText = formatRupiah(tCogs);
        document.getElementById('profNet').innerText = formatRupiah(tNet);
        document.getElementById('profCount').innerText = uniqueOrders.size;
    } catch(e) {
        console.error('renderAuditSummary error:', e);
    }
}
/* =========================================================
   QUICK POS BRIDGE — reuses existing product/catalog/cart functions
   ========================================================= */
(function(){
  var quickState={query:'',category:'all',selected:''};
  function el(id){return document.getElementById(id)}
  function productName(option){return (option.textContent||option.innerText||option.value||'').trim()}
  function categoryFor(name){
    var n=name.toLowerCase();
    if(/pack|paket|isi/.test(n)) return 'package';
    return 'food';
  }
  function syncQuickVariant(){
    var source=el('packSelect'), target=el('quickPackSelect');
    if(!source||!target) return;
    target.innerHTML=source.innerHTML||'<option value="">Pilih varian</option>';
    target.value=source.value;
  }
  function selectProduct(value){
    var source=el('prodSelect');
    if(!source) return;
    source.value=value;
    quickState.selected=value;
    if(typeof updatePackageOptions==='function') updatePackageOptions();
    if(typeof updateItemPreview==='function') updateItemPreview();
    setTimeout(function(){
      syncQuickVariant();
      var option=source.options[source.selectedIndex];
      var name=option?productName(option):value;
      var label=el('quickSelectedProduct');
      if(label) label.innerHTML='Dipilih: <strong>'+name+'</strong>';
      document.querySelectorAll('.quick-product-button').forEach(function(btn){btn.classList.toggle('selected',btn.dataset.value===value)});
    },30);
  }
  function renderQuickProducts(){
    var grid=el('quickProductGrid'), source=el('prodSelect');
    if(!grid||!source) return;
    var q=quickState.query.toLowerCase();
    var options=[].slice.call(source.options).filter(function(o){return o.value && !o.disabled});
    var filtered=options.filter(function(o){
      var name=productName(o).toLowerCase();
      var matchesQuery=!q||name.indexOf(q)>-1||String(o.value).toLowerCase().indexOf(q)>-1;
      var matchesCategory=quickState.category==='all'||categoryFor(name)===quickState.category;
      return matchesQuery&&matchesCategory;
    });
    grid.innerHTML='';
    if(!filtered.length){grid.innerHTML='<div class="quick-empty">Produk tidak ditemukan. Coba kata kunci lain.</div>';return}
    filtered.forEach(function(option){
      var button=document.createElement('button'); button.type='button'; button.className='quick-product-button'; button.dataset.value=option.value;
      var name=productName(option); button.innerHTML=name+'<small>'+String(option.value)+'</small>';
      button.addEventListener('click',function(){selectProduct(option.value);setTimeout(function(){mirrorQuantity();if(typeof processAction==='function'&&el('actionType')&&el('actionType').value==='JUAL'){processAction();var q=el('quickQty'),qd=el('quickQtyDisplay');if(q){q.value='1';delete q.dataset.keyBuffer;}if(qd)qd.textContent='1';mirrorQuantity();}},100)}); grid.appendChild(button);
    });
    if(quickState.selected) document.querySelectorAll('.quick-product-button').forEach(function(btn){btn.classList.toggle('selected',btn.dataset.value===quickState.selected)});
  }
  function mirrorQuantity(){var q=el('quickQty'), legacy=el('txQty'), display=el('quickQtyDisplay'); if(q&&legacy){legacy.value=Math.max(1,parseInt(q.value||1,10));if(display)display.textContent=legacy.value;if(typeof updateItemPreview==='function') updateItemPreview()}}
  function normalizeBarcode(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,'')}
  function findBarcodeOption(code){var source=el('prodSelect');if(!source)return null;var target=normalizeBarcode(code);return [].slice.call(source.options).find(function(o){return o.value&&!o.disabled&&[o.value,o.dataset.barcode,o.getAttribute('data-barcode'),productName(o)].some(function(v){return normalizeBarcode(v)===target});})||null}
  function resetQuickQty(){var q=el('quickQty'),qd=el('quickQtyDisplay');if(q){q.value='1';delete q.dataset.keyBuffer;}if(qd)qd.textContent='1';mirrorQuantity()}
  function autoAddQuickSelection(){setTimeout(function(){mirrorQuantity();if(typeof processAction==='function'&&el('actionType')&&el('actionType').value==='JUAL')processAction();resetQuickQty();},100)}
  function scanBarcode(code){var option=findBarcodeOption(code);if(!option){if(typeof showToast==='function')showToast('Barcode/SKU tidak ditemukan: '+code,true);return false;}var search=el('quickProductSearch');if(search){search.value='';quickState.query='';}renderQuickProducts();selectProduct(option.value);autoAddQuickSelection();return true}
  function initQuickPOS(){
    if(window.__jagoQuickPOSInitialized)return;
    window.__jagoQuickPOSInitialized=true;
    var search=el('quickProductSearch'), source=el('prodSelect'), pack=el('quickPackSelect'), qty=el('quickQty');
    if(!source) return;
    renderQuickProducts(); syncQuickVariant();
    if(search) search.addEventListener('input',function(){quickState.query=this.value;renderQuickProducts()});
    document.querySelectorAll('.quick-category').forEach(function(btn){btn.addEventListener('click',function(){quickState.category=this.dataset.category;document.querySelectorAll('.quick-category').forEach(function(b){b.classList.toggle('active',b===btn)});renderQuickProducts()})});
    if(pack) pack.addEventListener('change',function(){var legacy=el('packSelect');if(legacy){legacy.value=this.value;if(typeof updateItemPreview==='function')updateItemPreview()}});
    if(qty) qty.addEventListener('input',function(){delete this.dataset.keyBuffer;mirrorQuantity()});
    var minus=el('quickQtyMinus'), plus=el('quickQtyPlus');
    if(minus) minus.addEventListener('click',function(){if(qty)delete qty.dataset.keyBuffer;qty.value=Math.max(1,parseInt(qty.value||1,10)-1);mirrorQuantity()});
    if(plus) plus.addEventListener('click',function(){if(qty)delete qty.dataset.keyBuffer;qty.value=Math.max(1,parseInt(qty.value||1,10)+1);mirrorQuantity()});
    var add=el('quickAddButton'); if(add) add.addEventListener('click',function(){mirrorQuantity();if(typeof processAction==='function')processAction();resetQuickQty()});
    var barcodeButton=el('barcodeFocusButton');if(barcodeButton&&search)barcodeButton.addEventListener('click',function(){search.focus();search.select();if(typeof showToast==='function')showToast('Scanner siap. Scan barcode lalu tekan Enter.');});
    document.querySelectorAll('.classic-keypad button').forEach(function(button){button.addEventListener('click',function(){var key=String(button.textContent||'').trim();if(key==='QTY'){if(qty){delete qty.dataset.keyBuffer;qty.focus()}return}if(!qty)return;var buffer=String(qty.dataset.keyBuffer||'');if(key==='000')buffer=buffer+'000';else if(/^[0-9]$/.test(key))buffer=buffer+key;else return;if(buffer.length>1)buffer=buffer.replace(/^0+(?=\d)/,'');qty.dataset.keyBuffer=buffer;qty.value=buffer||'1';mirrorQuantity();});});
    if(search) search.addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();var raw=this.value.trim();if(raw&&findBarcodeOption(raw)){scanBarcode(raw);return}var first=document.querySelector('.quick-product-button');if(first)first.click()}});
    if(qty) qty.addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();var addButton=el('quickAddButton');if(addButton)addButton.click()}});
    document.addEventListener('keydown',function(event){var active=document.activeElement,tag=active&&active.tagName;if(!document.body.classList.contains('workspace-cashier')||['INPUT','TEXTAREA','SELECT'].indexOf(tag)>-1)return;var key=event.key;if(key==='F2'){event.preventDefault();if(qty)qty.focus()}else if(key==='F4'){event.preventDefault();loadHeldOrders()}else if(key==='F6'){event.preventDefault();openSplitBill()}else if(key==='F8'){event.preventDefault();holdCurrentOrder()}else if(key==='F9'){event.preventDefault();checkoutOrder()}});
    source.addEventListener('change',function(){quickState.selected=this.value;syncQuickVariant();renderQuickProducts()});
    new MutationObserver(function(){renderQuickProducts();syncQuickVariant()}).observe(source,{childList:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initQuickPOS); else initQuickPOS();
})();
function toggleFullscreenCashier(force){
  var enabled=typeof force==='boolean'?force:!document.body.classList.contains('cashier-fullscreen');
  document.body.classList.toggle('cashier-fullscreen',enabled);
  var btn=document.getElementById('fullscreenCashierBtn');
  if(btn){btn.textContent=enabled?'× Keluar Mode Kasir':'▣ Mode Kasir Penuh';btn.setAttribute('aria-pressed',enabled?'true':'false')}
  try{localStorage.setItem('mantulCashierFullscreen',enabled?'1':'0')}catch(e){}
  window.scrollTo({top:0,behavior:'smooth'});
}
(function initFullscreenCashier(){
  function boot(){
    var saved=false;try{saved=localStorage.getItem('mantulCashierFullscreen')==='1'}catch(e){}
    // Full Cashier Mode tidak dipulihkan otomatis pada startup; user harus memilihnya setelah login.
    document.addEventListener('keydown',function(event){
      if(event.key==='F11'){event.preventDefault();toggleFullscreenCashier()}
      if(event.key==='Escape'&&document.body.classList.contains('cashier-fullscreen')) toggleFullscreenCashier(false);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
(function initNewCashierUI(){
  function boot(){
    var tableLabel=document.getElementById('cashierSelectedTable');
    document.querySelectorAll('.cashier-table-button').forEach(function(button){
      button.addEventListener('click',function(){
        document.querySelectorAll('.cashier-table-button').forEach(function(item){item.classList.remove('active')});
        button.classList.add('active');
        if(tableLabel) tableLabel.textContent=button.dataset.table;var cartContext=document.getElementById('cartContextDisplay');if(cartContext)cartContext.innerHTML=button.dataset.table.toUpperCase()+' <span>• Transaksi aktif</span>';var classicTable=document.getElementById('classicTableStatus');if(classicTable)classicTable.textContent='TABLE: '+button.dataset.table.toUpperCase();
        try{localStorage.setItem('mantulSelectedTable',button.dataset.table)}catch(e){}
        var customer=document.getElementById('customerName');
        if(customer && (!customer.value||customer.dataset.tableManaged==='1')){customer.value=button.dataset.table;customer.dataset.tableManaged='1'}
      });
    });
    var savedTable='';try{savedTable=localStorage.getItem('mantulSelectedTable')||''}catch(e){}
    if(savedTable){var savedButton=document.querySelector('.cashier-table-button[data-table="'+savedTable.replace(/"/g,'\\"')+'"]');if(savedButton)savedButton.click()}
    function setTheme(theme,color){
      document.body.classList.remove('cashier-theme-dark','cashier-theme-custom');
      if(theme==='dark')document.body.classList.add('cashier-theme-dark');
      if(theme==='custom'){
        document.body.classList.add('cashier-theme-custom');
        if(color)document.body.style.setProperty('--cashier-accent',color);
      }else document.body.style.removeProperty('--cashier-accent');
      document.querySelectorAll('.cashier-theme-button').forEach(function(item){item.classList.toggle('active',item.dataset.cashierTheme===theme)});
      try{localStorage.setItem('mantulCashierTheme',theme);if(color)localStorage.setItem('mantulCashierColor',color)}catch(e){}
    }
    document.querySelectorAll('.cashier-theme-button').forEach(function(button){button.addEventListener('click',function(){setTheme(button.dataset.cashierTheme)})});
    var colorPicker=document.getElementById('cashierCustomColor');
    if(colorPicker)colorPicker.addEventListener('input',function(){setTheme('custom',this.value)});
    var savedTheme='light',savedColor='#2563eb';try{savedTheme=localStorage.getItem('mantulCashierTheme')||'light';savedColor=localStorage.getItem('mantulCashierColor')||savedColor}catch(e){}
    if(colorPicker)colorPicker.value=savedColor;setTheme(savedTheme,savedColor);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
(function initClassicKeypad(){
  function boot(){
    var keypad=document.querySelector('.classic-keypad');var qty=document.getElementById('quickQty');var legacy=document.getElementById('txQty');
    if(window.__jagoQuickPOSInitialized)return;
    if(!keypad||!qty)return;
    keypad.querySelectorAll('button').forEach(function(button){
      var key=(button.textContent||'').trim();
      button.addEventListener('click',function(){
        if(key==='QTY'){qty.focus();qty.select();return}
        var target=document.activeElement;
        if(!target||(target.id!=='quickQty'&&target.id!=='cartDiscount'&&target.id!=='cashTendered')) target=qty;
        var current=String(target.value||'');
        if(key==='000'){current=current==='0'?'':current;target.value=(current||'0')+'000'}
        else if(/^[0-9]$/.test(key)){target.value=(current==='0'?'':current)+key}
        if(target.id==='quickQty') target.value=Math.max(1,parseInt(target.value||1,10));
        if(target.id==='quickQty'&&legacy)legacy.value=target.value;
        if(typeof updateItemPreview==='function')updateItemPreview();
        if(typeof updateCartSummary==='function')updateCartSummary();
        if(typeof updateChange==='function')updateChange();
      });
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
(function initClassicClock(){
  function tick(){var node=document.getElementById('classicClockStatus');if(node){var d=new Date();node.textContent=d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}}
  tick();setInterval(tick,1000);
})();
async function loadManagedUsers(){
  if(currentUserRole!=='admin')return alert('Akses User Management hanya untuk Admin.');
  try{var ctx=getTenantContext();var url=CLOUD_URL+'?resource=users&tenantId='+encodeURIComponent(ctx.tenantId)+'&branchId='+encodeURIComponent(ctx.branchId)+'&userId='+encodeURIComponent(ctx.userId)+'&role='+encodeURIComponent(ctx.role)+'&sessionToken='+encodeURIComponent(ctx.sessionToken||'');var res=await fetch(url);var data=await res.json();if(data.status==='error')throw new Error(data.message||'Gagal memuat user');var list=data.users||[];var target=document.getElementById('managedUserList');if(target){if(!list.length)target.innerHTML='<div class="empty-cart-msg">Belum ada user pada tenant/cabang ini.</div>';else{var html='<table class="admin-user-table"><thead><tr><th>User ID</th><th>Nama</th><th>Role</th><th>Cabang</th><th>Status</th></tr></thead><tbody>';list.forEach(function(u){html+='<tr><td>'+u.userId+'</td><td>'+u.name+'</td><td>'+u.role+'</td><td>'+u.branchId+'</td><td>'+(u.active?'Aktif':'Nonaktif')+'</td></tr>'});target.innerHTML=html+'</tbody></table>'}}var status=document.getElementById('managedUserStatus');if(status)status.textContent='✅ '+list.length+' user dimuat';}catch(e){var status=document.getElementById('managedUserStatus');if(status)status.textContent='❌ '+e.message;console.error(e)}
}
async function saveManagedUser(){
  if(currentUserRole!=='admin')return alert('Akses User Management hanya untuk Admin.');var user={userId:(document.getElementById('managedUserId')||{}).value.trim(),name:(document.getElementById('managedUserName')||{}).value.trim(),role:(document.getElementById('managedUserRole')||{}).value,branchId:(document.getElementById('managedUserBranch')||{}).value.trim()||'*',pin:(document.getElementById('managedUserPin')||{}).value};if(!user.name||!user.pin)return alert('Nama dan PIN wajib diisi.');try{var ctx=getTenantContext();var payload={action:'USER_SAVE',type:'USER',tenantContext:ctx,identity:ctx,sessionToken:ctx.sessionToken||'',user:user};await fetch(CLOUD_URL,{method:'POST',mode:'no-cors',body:JSON.stringify(payload)});var status=document.getElementById('managedUserStatus');if(status)status.textContent='✅ User dikirim untuk disimpan';document.getElementById('managedUserPin').value='';loadManagedUsers();alert('✅ User tersimpan.');}catch(e){alert('❌ Gagal menyimpan user: '+e.message)}
}
function openAdminSection(section){
  if(!document.body.classList.contains('workspace-admin'))openWorkspace('admin');
  document.body.setAttribute('data-admin-section',section);
  var toolsTitle=document.querySelector('#boxTools>h2');if(toolsTitle)toolsTitle.textContent=section==='data'?'💾 DATA & IMPORT':section==='audit'?'🛡️ KEAMANAN & AUDIT':'⚙️ ADMIN TOOLS';
  document.querySelectorAll('.admin-sub-btn').forEach(function(btn){btn.classList.toggle('active',btn.dataset.adminSection===section)});
  if(section==='identity'){var p=document.getElementById('adminIdentityPanel');if(p)setTimeout(function(){p.scrollIntoView({behavior:'smooth',block:'start'});},50);return}
  var target=null;if(section==='settings')target=document.getElementById('boxTheme');if(section==='data')target=document.querySelector('.global-import-panel');if(section==='audit')target=document.getElementById('boxTools');if(section==='receipt')target=document.querySelector('#boxTools .settings-group[data-admin-block="receipt"]');if(target)setTimeout(function(){target.scrollIntoView({behavior:'smooth',block:'start'});},50);
}
async function migrateLegacyToActiveTenant(){if(currentUserRole!=='admin')return alert('Akses migrasi hanya untuk Admin.');var ctx=getTenantContext();var first=confirm('Data lama akan disalin ke '+ctx.tenantId+' / '+ctx.branchId+' dan data legacy asli tetap dipertahankan. Lanjutkan?');if(!first)return;var second=prompt('Ketik MIGRATE LEGACY untuk konfirmasi:','');if(second!=='MIGRATE LEGACY')return alert('Migrasi dibatalkan.');try{await fetch(CLOUD_URL,{method:'POST',mode:'no-cors',body:JSON.stringify({action:'MIGRATE_LEGACY',type:'MIGRATION',confirmation:'REPLACE_CONFIRMED',tenantContext:ctx,identity:ctx,sessionToken:ctx.sessionToken||''})});alert('✅ Permintaan migrasi dikirim. Tekan Refresh setelah selesai.');await loadFromCloud();}catch(e){alert('❌ Migrasi gagal: '+e.message)}}
function saveAdminTenantContext(){
  if(currentUserRole!=='admin')return alert('Akses ditolak.');var oldCtx=getTenantContext();var data={tenantId:(document.getElementById('adminTenantId')||{}).value||'MANTUL-KITCHEN',branchId:(document.getElementById('adminBranchId')||{}).value||'CABANG-UTAMA',tenantName:(document.getElementById('adminTenantName')||{}).value||'MANTUL KITCHEN',userId:oldCtx.userId,role:oldCtx.role,sessionToken:oldCtx.sessionToken||'',updatedAt:new Date().toISOString()};try{localStorage.setItem('mantulAdminTenantContext',JSON.stringify(data))}catch(e){}alert('✅ Konteks tenant dan cabang disimpan di perangkat ini.');if(typeof loadFromCloud==='function')loadFromCloud();
}
function loadAdminTenantContext(){try{var data=JSON.parse(localStorage.getItem('mantulAdminTenantContext')||'{}');if(data.tenantId&&document.getElementById('adminTenantId'))document.getElementById('adminTenantId').value=data.tenantId;if(data.branchId&&document.getElementById('adminBranchId'))document.getElementById('adminBranchId').value=data.branchId;if(data.tenantName&&document.getElementById('adminTenantName'))document.getElementById('adminTenantName').value=data.tenantName}catch(e){}}
async function restoreAccountSession(){try{var ctx=getTenantContext();if(!ctx.sessionToken)return;var url=CLOUD_URL+'?sessionToken='+encodeURIComponent(ctx.sessionToken);var r=await fetch(url);var data=await r.json();if(data.status==='success'&&data.identity){applyAccountSession({sessionToken:ctx.sessionToken,identity:data.identity});}else{localStorage.removeItem('mantulAdminTenantContext')}}catch(e){console.warn('Session restore gagal',e)}}
function getTenantContext(){
  var fallback={tenantId:'MANTUL-KITCHEN',branchId:'CABANG-UTAMA',tenantName:'MANTUL KITCHEN',userId:'local-'+(currentUserRole||'admin'),role:currentUserRole||'admin',sessionToken:'',shiftId:''};try{var data=JSON.parse(localStorage.getItem('mantulAdminTenantContext')||'{}');return {tenantId:data.tenantId||fallback.tenantId,branchId:data.branchId||fallback.branchId,tenantName:data.tenantName||fallback.tenantName,userId:data.userId||('local-'+(currentUserRole||fallback.role)),role:currentUserRole||fallback.role,sessionToken:data.sessionToken||fallback.sessionToken,shiftId:data.shiftId||''}}catch(e){return fallback}}
function stampRecordIdentity(record){var ctx=getTenantContext();record.tenantId=ctx.tenantId;record.branchId=ctx.branchId;record.userId=ctx.userId;record.role=ctx.role;return record}
function openInventorySection(section){
  if(!document.body.classList.contains('workspace-inventory'))openWorkspace('inventory');
  document.body.setAttribute('data-inventory-section',section);
  document.querySelectorAll('.inventory-sub-btn').forEach(function(btn){btn.classList.toggle('active',btn.dataset.inventorySection===section)});
  if(section==='mutasi'){switchTab('mutasi');return}
  if(section==='soh'){switchTab('soh');return}
  switchTab('dashboard');
  var target=null;
  if(section==='stock')target=document.getElementById('boxStock');
  if(section==='adjust')target=document.getElementById('boxTools');
  if(section==='catalog')target=document.getElementById('addMenuForm');
  if(section==='import')target=document.querySelector('.global-import-panel');
  if(target)setTimeout(function(){target.scrollIntoView({behavior:'smooth',block:'start'});},50);
}
function openWorkspace(workspace){
  if(workspace==='cashier')loadHeldOrders();
  if(workspace==='admin'&&currentUserRole!=='admin'){alert('Akses Admin hanya untuk Admin.');return}
  var body=document.body;body.classList.remove('cashier-tester-mode');body.classList.remove('workspace-inventory','workspace-admin','workspace-overview','workspace-reports','workspace-cashier','workspace-guide');body.classList.add('workspace-'+workspace);
  if(workspace==='admin') body.setAttribute('data-admin-section','identity'); else body.removeAttribute('data-admin-section');
  if(workspace==='inventory') body.setAttribute('data-inventory-section','stock'); else body.removeAttribute('data-inventory-section');
  document.querySelectorAll('.workspace-btn').forEach(function(btn){btn.classList.toggle('active',btn.dataset.workspace===workspace)});
  var hints={overview:'Pantau kinerja bisnis, penjualan, stok, dan aktivitas hari ini.',cashier:'Buat pesanan, kelola meja, terima pembayaran, dan kirim struk.',inventory:'Kelola produk, import data, stok, pergerakan, dan nilai persediaan.',reports:'Baca pendapatan, laba, pengeluaran, dan performa operasional.',admin:'Kelola tim, bisnis, tampilan, data, backup, dan keamanan.'};var hint=document.getElementById('workspaceHint');if(hint)hint.textContent=hints[workspace]||hints.overview;
  if(workspace==='cashier'){toggleFullscreenCashier(true);return}
  if(document.body.classList.contains('cashier-fullscreen'))toggleFullscreenCashier(false);
  if(workspace==='reports'){switchTab('profit');return}
  switchTab('dashboard');
  if(workspace==='inventory')body.classList.add('workspace-inventory');
  if(workspace==='admin'){body.classList.add('workspace-admin');setTimeout(function(){if(typeof loadManagedUsers==='function'&&currentUserRole==='admin')loadManagedUsers()},120)}
}
(function initAdminIdentity(){function boot(){var role=document.getElementById('adminActiveRole');if(role)role.value=(typeof currentUserRole!=='undefined'?currentUserRole:'admin');loadAdminTenantContext();restoreAccountSession()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot()})();
var pendingMenuImport=[];
function downloadMenuTemplate(){
  var csv='SKU,Nama Produk,HPP Pcs,Stok Awal,Label Varian,Pcs per Pack,Harga per Pack\nM-101,Nasi Goreng Spesial,12000,20,1 Porsi,1,25000\nM-102,Es Teh Manis,2500,50,Gelas,1,8000';
  var blob=new Blob(['\\ufeff'+csv],{type:'text/csv;charset=utf-8;'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='template_import_menu_mantul.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function normalizeImportHeader(value){return String(value||'').toLowerCase().trim().replace(/[._-]+/g,' ').replace(/\s+/g,' ')}
function parseSimpleCSV(text){
  var rows=[],row=[],cell='',quoted=false;
  for(var i=0;i<text.length;i++){var ch=text[i],next=text[i+1];if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;continue}if(ch==='"'){quoted=!quoted;continue}if(ch===','&&!quoted){row.push(cell.trim());cell='';continue}if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell.trim());if(row.some(function(v){return v!==''}))rows.push(row);row=[];cell='';continue}cell+=ch}if(cell!==''||row.length){row.push(cell.trim());if(row.some(function(v){return v!==''}))rows.push(row)}return rows;
}
function setMenuImportStatus(text,type){var el=document.getElementById('menuImportStatus');if(!el)return;el.textContent=text;el.className='import-status '+(type||'')}
function renderMenuImportPreview(rows){
  var box=document.getElementById('menuImportPreview');if(!box)return;var show=rows.slice(0,8);if(!show.length){box.innerHTML='';return}
  var html='<table><thead><tr>'+['SKU','Nama Produk','HPP','Stok','Varian','Pcs/Pack','Harga/Pack'].map(function(h){return '<th>'+h+'</th>'}).join('')+'</tr></thead><tbody>';
  show.forEach(function(r){html+='<tr>'+r.map(function(v){return '<td>'+String(v==null?'':v).replace(/[<>]/g,'')+'</td>'}).join('')+'</tr>'});html+='</tbody></table>';if(rows.length>8)html+='<div style="color:var(--muted);font-size:.65rem;margin-top:5px;">Menampilkan 8 dari '+rows.length+' baris.</div>';box.innerHTML=html;
}
function handleMenuImportFile(file){
  if(currentUserRole!=='admin')return alert('Akses import hanya untuk Admin.');
  if(!file)return;
  var reader=new FileReader();reader.onload=function(event){try{
    var rows=[];
    if(/\.xlsx?$/.test(file.name.toLowerCase())){if(typeof XLSX==='undefined')throw new Error('Modul Excel belum tersedia. Gunakan CSV atau periksa koneksi internet.');var workbook=XLSX.read(event.target.result,{type:'array'});var sheet=workbook.Sheets[workbook.SheetNames[0]];rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''})}else rows=parseSimpleCSV(event.target.result);
    if(!rows.length)throw new Error('File kosong.');
    var headers=rows[0].map(normalizeImportHeader);var required=['sku','nama produk','hpp pcs','stok awal','label varian','pcs per pack','harga per pack'];var missing=required.filter(function(h){return headers.indexOf(h)<0});if(missing.length)throw new Error('Kolom wajib belum lengkap: '+missing.join(', '));
    var idx={};headers.forEach(function(h,i){idx[h]=i});pendingMenuImport=[];var errors=[];
    rows.slice(1).forEach(function(r,line){if(!r||!r.length||r.every(function(v){return String(v).trim()===''}))return;var rec={sku:String(r[idx['sku']]||'').trim(),name:String(r[idx['nama produk']]||'').trim(),cogs:Number(r[idx['hpp pcs']]),stock:Number(r[idx['stok awal']]),label:String(r[idx['label varian']]||'').trim(),pcs:Number(r[idx['pcs per pack']]),price:Number(r[idx['harga per pack']])};if(!rec.sku||!rec.name||!isFinite(rec.cogs)||rec.cogs<0||!isFinite(rec.stock)||rec.stock<0||!rec.label||!isFinite(rec.pcs)||rec.pcs<=0||!isFinite(rec.price)||rec.price<0)errors.push('Baris '+(line+2)+' tidak valid');else pendingMenuImport.push(rec)});
    renderMenuImportPreview(rows.slice(1));var apply=document.getElementById('menuImportApply');if(apply)apply.disabled=!pendingMenuImport.length||errors.length>0;setMenuImportStatus(pendingMenuImport.length+' baris siap diimport.'+(errors.length?' '+errors.length+' baris error dan harus diperbaiki.':''),errors.length?'error':'success');if(errors.length)alert(errors.slice(0,8).join('\n'));
  }catch(e){pendingMenuImport=[];var apply=document.getElementById('menuImportApply');if(apply)apply.disabled=true;setMenuImportStatus('Gagal membaca file: '+e.message,'error');document.getElementById('menuImportPreview').innerHTML=''}};if(/\.xlsx?$/.test(file.name.toLowerCase()))reader.readAsArrayBuffer(file);else reader.readAsText(file,'UTF-8');
}
function applyMenuImport(){
  if(currentUserRole!=='admin')return alert('Akses import hanya untuk Admin.');if(!pendingMenuImport.length)return alert('Belum ada data import yang valid.');var mode=(document.getElementById('menuImportMode')||{}).value||'merge';if(mode==='replace'&&!confirm('Ganti seluruh katalog produk? Data katalog lama akan digantikan.'))return;
  var grouped={};pendingMenuImport.forEach(function(r){if(!grouped[r.sku])grouped[r.sku]={sku:r.sku,name:r.name,cogs:r.cogs,stock:r.stock,variants:[]};grouped[r.sku].variants.push({label:r.label,pcsPerPack:r.pcs,pricePerPack:r.price})});if(mode==='replace'){productCatalog={};inventory={}}
  Object.keys(grouped).forEach(function(sku){var r=grouped[sku];productCatalog[sku]={sku:sku,name:r.name,cogs:r.cogs,variants:r.variants,createdAt:productCatalog[sku]&&productCatalog[sku].createdAt||Date.now(),updatedAt:Date.now()};inventory[sku]=r.stock});
  productCatalog=validateAndFixProductCatalog(productCatalog);saveProductCatalog();saveToCloud();populateProductDropdown();updatePackageOptions();renderDashboard();setMenuImportStatus(Object.keys(grouped).length+' produk berhasil diproses dari '+pendingMenuImport.length+' baris.','success');pendingMenuImport=[];var apply=document.getElementById('menuImportApply');if(apply)apply.disabled=true;alert('✅ Import menu berhasil. Katalog dan stok awal sudah diperbarui.');
}
