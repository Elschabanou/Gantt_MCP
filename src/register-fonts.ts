// Side-effect module: register the bundled Porsche Next TT font with fontconfig
// before anything imports/uses sharp. Import this FIRST in every entry point.
import { registerPorscheFonts } from './utils/fonts.js';

registerPorscheFonts();
