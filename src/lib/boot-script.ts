export const SETTINGS_KEY = "clack:settings";

/**
 * Inline script run before first paint to avoid a theme flash. Mirrors
 * applySettingsToDocument but is self-contained (no imports).
 */
export const BOOT_SCRIPT = `(function(){try{
var raw=localStorage.getItem(${JSON.stringify(SETTINGS_KEY)});var s=raw?(JSON.parse(raw).state||{}):{};
var d=document.documentElement;var sysDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
var light={daylight:1,sakura:1,paper:1};
var t=s.followSystem?(sysDark?(s.darkTheme||'graphite'):(s.lightTheme||'daylight')):(s.theme||'graphite');
d.dataset.theme=t;d.dataset.dark=light[t]?'false':'true';d.dataset.font=s.font||'jetbrains';
d.dataset.contrast=s.highContrast?'high':'normal';d.dataset.cb=s.colorblind?'true':'false';
var rm=s.motion==='reduced'||((!s.motion||s.motion==='system')&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
d.dataset.motion=rm?'reduced':'full';
if(s.fontSize)d.style.setProperty('--type-size',s.fontSize+'rem');if(s.lineHeight)d.style.setProperty('--type-lh',String(s.lineHeight));
d.style.colorScheme=light[t]?'light':'dark';
}catch(e){}})();`;
