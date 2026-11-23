// jazyk náhradního AI panelu podle okna aplikace (ai-missing.html)
(function () {
  var l = 'cs';
  try { l = (window.parent && window.parent.TN && window.parent.TN.lang) || 'cs'; } catch (e) { /* jiný původ */ }
  document.documentElement.lang = l === 'en' ? 'en' : 'cs';
  var f = document.querySelector('.foot span:last-child');
  if (f && l === 'en') f.textContent = 'AI is not installed';
})();
