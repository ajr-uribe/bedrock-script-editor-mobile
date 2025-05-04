function configureMonacoThemes(monaco) {
  // 1. Tema "Midnight Purple" (Oscuro elegante)
  monaco.editor.defineTheme('midnight-purple', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '9b59b6', fontStyle: 'bold' },
      { token: 'string', foreground: 'e74c3c' },
      { token: 'number', foreground: '3498db' },
      { token: 'comment', foreground: '7f8c8d', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'f1c40f' },
      { token: 'operator', foreground: '1abc9c' },
      { token: 'type', foreground: '2ecc71' }
    ],
    colors: {
      'editor.background': '#2c0e37',
      'editor.foreground': '#ecf0f1',
      'editor.lineHighlightBackground': '#3a1a4a',
      'editorCursor.foreground': '#f39c12',
      'editor.selectionBackground': '#8e44ad55',
      'editor.lineNumbers': '#9b59b6',
      'editorGutter.background': '#2c0e37'
    }
  });

  // 2. Tema "Solarized Light" (Claro alternativo)
  monaco.editor.defineTheme('solarized-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '268bd2' },
      { token: 'string', foreground: '2aa198' },
      { token: 'number', foreground: 'd33682' },
      { token: 'comment', foreground: '93a1a1', fontStyle: 'italic' },
      { token: 'identifier', foreground: '657b83' },
      { token: 'operator', foreground: '6c71c4' },
      { token: 'type', foreground: 'b58900' }
    ],
    colors: {
      'editor.background': '#fdf6e3',
      'editor.foreground': '#657b83',
      'editor.lineHighlightBackground': '#eee8d5',
      'editorCursor.foreground': '#586e75',
      'editor.selectionBackground': '#07364222',
      'editor.lineNumbers': '#93a1a1',
      'editorGutter.background': '#fdf6e3'
    }
  });

  // 3. Tema "Matrix Green" (Oscuro intenso)
  monaco.editor.defineTheme('matrix-green', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '00ff41', fontStyle: 'bold' },
      { token: 'string', foreground: '008f11' },
      { token: 'number', foreground: '00c728' },
      { token: 'comment', foreground: '007a1e', fontStyle: 'italic' },
      { token: 'identifier', foreground: '00ff41' },
      { token: 'operator', foreground: '00a329' },
      { token: 'type', foreground: '00ff88' }
    ],
    colors: {
      'editor.background': '#000000',
      'editor.foreground': '#00ff41',
      'editor.lineHighlightBackground': '#001a09',
      'editorCursor.foreground': '#00ff41',
      'editor.selectionBackground': '#00ff4122',
      'editor.lineNumbers': '#00a329',
      'editorGutter.background': '#000000',
      'editorWidget.background': '#001a09'
    }
  });

  // 4. Tema "Ocean Blue" (Claro acuático)
  monaco.editor.defineTheme('ocean-blue', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '005f73', fontStyle: 'bold' },
      { token: 'string', foreground: '0a9396' },
      { token: 'number', foreground: '94d2bd' },
      { token: 'comment', foreground: '9b9b9b', fontStyle: 'italic' },
      { token: 'identifier', foreground: '001219' },
      { token: 'operator', foreground: '005f73' },
      { token: 'type', foreground: 'ee9b00' }
    ],
    colors: {
      'editor.background': '#e9f5f9',
      'editor.foreground': '#005f73',
      'editor.lineHighlightBackground': '#d4e8f0',
      'editorCursor.foreground': '#005f73',
      'editor.selectionBackground': '#94d2bd55',
      'editor.lineNumbers': '#0a9396',
      'editorGutter.background': '#e9f5f9',
      'editorWidget.background': '#d4e8f0'
    }
  });

  // 5. Tema "Dracula" (Oscuro popular)
  monaco.editor.defineTheme('dracula', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'ff79c6' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'f8f8f2' },
      { token: 'operator', foreground: 'ff79c6' },
      { token: 'type', foreground: '8be9fd' }
    ],
    colors: {
      'editor.background': '#282a36',
      'editor.foreground': '#f8f8f2',
      'editor.lineHighlightBackground': '#383a46',
      'editorCursor.foreground': '#f8f8f0',
      'editor.selectionBackground': '#44475a',
      'editor.lineNumbers': '#6272a4',
      'editorGutter.background': '#282a36'
    }
  });
}