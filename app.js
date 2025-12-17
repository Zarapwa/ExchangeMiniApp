// نمایش یک View بر اساس ID بخش مربوطه
function showView(viewId) {
  // مخفی کردن همه بخش‌هایی که کلاس 'view' دارند
  const allViews = document.querySelectorAll('.view');
  allViews.forEach(view => {
    view.classList.add('hidden');
  });

  // نمایش بخش موردنظر (حذف کلاس 'hidden' از آن)
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // به‌روزرسانی دکمه‌های ناوبری فعال/غیرفعال
  const navLinks = document.querySelectorAll('nav a[data-view]');
  navLinks.forEach(link => {
    // حذف کلاس active از همه لینک‌ها
    link.classList.remove('active');
    // در صورت تطابق data-view با viewId، افزودن active به لینک مربوطه
    if (link.getAttribute('data-view') === viewId) {
      link.classList.add('active');
    }
  });
}

// تنظیم رویدادهای ناوبری روی دکمه‌ها
function setupNav() {
  const navLinks = document.querySelectorAll('nav a[data-view]');
  navLinks.forEach(link => {
    link.addEventListener('click', function(event) {
      event.preventDefault();  // جلوگیری از عملکرد پیش‌فرض لینک
      const viewId = link.getAttribute('data-view');
      if (viewId) {
        showView(viewId);
      }
    });
  });
}

// اجرای تنظیم ناوبری پس از بارگذاری صفحه
document.addEventListener('DOMContentLoaded', setupNav);
