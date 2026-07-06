import tree_sitter_javascript as tsjs
from tree_sitter import Language, Parser
JS_LANGUAGE = Language(tsjs.language())
parser = Parser(JS_LANGUAGE)
with open('dist/extension.js', 'rb') as f:
    tree = parser.parse(f.read())
print("Parsed extension.js successfully!")
