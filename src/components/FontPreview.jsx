import React from 'react';
import './FontPreview.css';
import './FontImports.css';

const FontPreview = ({ inputText, selectedFont, onFontSelect }) => {
    const fontCategories = {
        '英語フォント - 筆記体・手書き': [
        { name: 'cudi', font: 'Dancing Script, cursive' },
        { name: 'george', font: 'Kaushan Script, cursive' },
        { name: 'pop', font: 'Pacifico, cursive' },
        { name: 'offset', font: 'Sacramento, cursive' },
        { name: 'britney', font: 'Satisfy, cursive' },
        { name: 'jay', font: 'Yellowtail, cursive' },
        { name: 'baby', font: 'Indie Flower, cursive' },
        { name: 'knowles', font: 'Caveat, cursive' },
        { name: 'lana', font: 'Amatic SC, cursive' },
        { name: 'snoop', font: 'Shadows Into Light, cursive' },
        { name: 'travis', font: 'Architects Daughter, cursive' },
        { name: 'quavo', font: 'Griffy, cursive' },
        { name: 'drizzy', font: 'Monoton, cursive' },
        { name: 'robert', font: 'Audiowide, cursive' },
        { name: 'script3', font: 'Courgette, cursive' },
        { name: 'script4', font: 'Leckerli One, cursive' },
        { name: 'script6', font: 'Cookie, cursive' },
        { name: 'script7', font: 'Tangerine, cursive' },
        { name: 'script8', font: 'Handlee, cursive' },
        { name: 'script11', font: 'Nothing You Could Do, cursive' },
        { name: 'script15', font: 'Reenie Beanie, cursive' },
        { name: 'script16', font: 'Arizonia, cursive' },
        { name: 'script19', font: 'Rouge Script, cursive' },
        { name: 'script20', font: 'Marck Script, cursive' },
        { name: 'script21', font: 'Clicker Script, cursive' },
        { name: 'script22', font: 'Mrs Saint Delafield, cursive' },
        { name: 'script25', font: 'Butterfly Kids, cursive' },
        { name: 'script27', font: 'Dawning of a New Day, cursive' },
        { name: 'script29', font: 'Amatic SC, cursive' },
        { name: 'Weekender', font: 'Comfortaa, cursive' },
        { name: 'Neonscript', font: 'Monoton, cursive' },
        { name: 'Photogenic', font: 'Great Vibes, cursive' },
        { name: 'Rocket', font: 'Faster One, cursive' },
        { name: 'Signature', font: 'Allura, cursive' },
        { name: 'Sorrento', font: 'Amatic SC, cursive' },
        { name: 'ClassicType', font: 'Alex Brush, cursive' },
        { name: 'Neo Tokyo', font: 'Orbitron, cursive' },
        { name: 'MONACO', font: 'Sacramento, cursive' },
        { name: 'SIMPLICITY', font: 'Satisfy, cursive' },
        { name: 'Typewriter', font: 'Courier Prime, cursive' },
        { name: 'Majorca', font: 'Satisfy, cursive' },
        { name: 'Manhattan', font: 'Kaushan Script, cursive' },
        { name: 'NEONLITE', font: 'Syncopate, cursive' },
        { name: 'SCIFI', font: 'Audiowide, cursive' },
        { name: 'VANCOUVER', font: 'Caveat, cursive' },
        { name: 'WestCoast', font: 'Surfer, cursive' }
        ],
        '日本語フォント - ベーシック': [
        { name: 'jp1', font: 'Noto Sans JP, sans-serif' },
        { name: 'jp2', font: 'Noto Serif JP, serif' },
        { name: 'jp5', font: 'Kosugi, sans-serif' },
        { name: 'jp6', font: 'Kosugi Maru, sans-serif' },
        { name: 'jp7', font: 'Sawarabi Mincho, serif' }
        ],
        '日本語フォント - 装飾・ポップ': [
        { name: 'jp9', font: 'Hachi Maru Pop, cursive' },
        { name: 'jp10', font: 'Kiwi Maru, cursive' },
        { name: 'jp12', font: 'Stick, sans-serif' },
        { name: 'jp16', font: 'Train One, cursive' }
        ],
        '日本語フォント - ユニーク・伝統': [
        { name: 'jp17', font: 'Yusei Magic, sans-serif' },
        { name: 'jp18', font: 'RocknRoll One, sans-serif' },
        { name: 'jp20', font: 'New Tegomin, serif' },
        { name: 'jp21', font: 'Yomogi, cursive' },
        { name: 'jp22', font: 'Shippori Mincho, serif' },
        { name: 'jp24', font: 'Kaisei Opti, serif' }
        ],
        '日本語フォント - ゲーム・未来': [
        { name: 'jp47', font: 'Gamja Flower, cursive' },
        { name: 'jp48', font: 'Shizuru, cursive' }
        ]
    };

    const displayText = inputText || 'Sample Text';

    return (
        <div className="font-preview-container">
            <h3>フォントプレビュー</h3>
            <div className="font-preview-categories">
                {Object.entries(fontCategories).map(([categoryName, fonts]) => (
                    <div key={categoryName} className="font-category">
                        <h4 className="category-title">{categoryName}</h4>
                        <div className="font-preview-grid">
                            {fonts.map((fontItem) => (
                                <div 
                                    key={fontItem.name}
                                    className={`font-preview-item ${selectedFont === fontItem.name ? 'selected' : ''}`}
                                    onClick={() => onFontSelect(fontItem.name)}
                                >
                                    <div className="font-name">{fontItem.name}</div>
                                    <div 
                                        className="font-preview-text"
                                        style={{ fontFamily: fontItem.font }}
                                    >
                                        {displayText}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FontPreview;