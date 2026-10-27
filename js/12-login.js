/* اسکریپت ورود (منبع: خطوط ۶۳۵-۶۵۸) */
(function(){
  const VALID_USER='reza', VALID_PASS='123456', AUTH_KEY='panel_auth_ok';
  const gate=document.getElementById('loginGate');
  const inpU=document.getElementById('loginUser');
  const inpP=document.getElementById('loginPass');
  const btn=document.getElementById('loginBtn');
  const errBox=document.getElementById('loginError');
  if (sessionStorage.getItem(AUTH_KEY)==='1'){gate.remove();return;}
  document.body.style.overflow='hidden';
  function showError(msg){errBox.textContent=msg;errBox.style.display='block';errBox.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:250});}
  function tryLogin(){
    const u=inpU.value.trim(),p=inpP.value;
    if (!u||!p){showError('نام کاربری و رمز عبور را وارد کنید.');return;}
    if (u===VALID_USER&&p===VALID_PASS){
      sessionStorage.setItem(AUTH_KEY,'1');
      gate.style.transition='opacity .25s';gate.style.opacity='0';
      setTimeout(()=>{gate.remove();document.body.style.overflow='';},250);
    } else {showError('نام کاربری یا رمز عبور اشتباه است.');inpP.value='';inpP.focus();}
  }
  btn.addEventListener('click',tryLogin);
  inpU.addEventListener('keydown',e=>{if(e.key==='Enter')inpP.focus();});
  inpP.addEventListener('keydown',e=>{if(e.key==='Enter')tryLogin();});
  inpU.focus();
})();
