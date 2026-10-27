/* اسکریپت تم: اجرای سریع قبل از رندر (منبع: head خطوط ۱۴-۲۱) */
(function(){
  try{
    var t = localStorage.getItem('appTheme') || 'blue';
    document.documentElement.setAttribute('data-theme', t);
  }catch(e){
    document.documentElement.setAttribute('data-theme','blue');
  }
})();
