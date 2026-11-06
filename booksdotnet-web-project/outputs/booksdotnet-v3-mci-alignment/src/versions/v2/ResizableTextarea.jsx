import './resizable-textarea.css';
export default function ResizableTextarea({className='',...props}) {
 return <textarea {...props} className={`v3-resizable-textarea ${className}`}/>;
}
