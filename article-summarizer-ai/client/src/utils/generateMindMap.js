const generateMermaidMindMap = (title, keyPoints) => {
  if (!keyPoints || keyPoints.length === 0) {
    return '';
  }

  const sanitize = (text) =>
    text
      .replace(/["\[\]{}()]/g, '')
      .trim()
      .slice(0, 60);

  const rootTitle = sanitize(title || 'Article');
  const points = keyPoints.slice(0, 6).map(sanitize).filter(Boolean);

  if (points.length === 0) {
    return '';
  }

  let mermaidSyntax = `mindmap
  root((${rootTitle}))`;

  points.forEach((point, index) => {
    const indent = '    ';
    mermaidSyntax += `\n${indent}${index + 1}. ${point}`;
  });

  return mermaidSyntax;
};

export default generateMermaidMindMap;
