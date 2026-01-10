import json
from typing import Dict, List, Set
import re

# Step 1: Compile JSON Schema to Regex Grammar
def schema_to_regex(schema: Dict) -> str:
  if schema.get("type") == "object":
      properties = schema.get("properties", {})
      patterns = []
      for key, value_schema in properties.items():
          if value_schema.get("type") == "string":
              patterns.append(f'"{key}"\\s*:\\s*"[^"]*"')
          elif value_schema.get("type") == "integer":
              patterns.append(f'"{key}"\\s*:\\s*\\d+')

      # Build full JSON object pattern
      inner_pattern = "\\s*,\\s*".join(patterns)
      return f"\\{{\\s*{inner_pattern}\\s*\\}}"

  return ""

# Step 2: Build Finite State Machine from Regex
class SimpleFSM:
  def __init__(self, regex_pattern: str):
      self.pattern = regex_pattern
      self.compiled_regex = re.compile(regex_pattern)
      self.current_state = 0  # Simplified: single state tracker
      self.partial_match = ""

  def get_allowed_next_chars(self, current_text: str) -> Set[str]:
      """
      Determine which characters can validly extend current_text.
      Real FSMs precompute transitions for each state.
      """
      allowed = set()

      # Test each possible next character
      test_chars = list('abcdefghijklmnopqrstuvwxyz0123456789"{}: ,')
      for char in test_chars:
          test_str = current_text + char
          # Check if this could be a valid partial match
          if self._is_valid_prefix(test_str):
              allowed.add(char)

      return allowed

  def _is_valid_prefix(self, text: str) -> bool:
      """Check if text could be a valid prefix of a match."""
      # Simple heuristic: try to match partial string
      # Real implementations use DFA state transitions
      try:
          # Check if any string starting with this prefix could match
          pattern = f"^{re.escape(text)}"
          return bool(re.search(pattern, self.pattern)) or self.compiled_regex.match(text + "}" * 10)  # Simplified check
      except:
          return False

# Step 3: Create Binary Token Mask
class TokenMasker:
  def __init__(self, fsm: SimpleFSM):
      self.fsm = fsm
     
      self.vocab = [chr(i) for i in range(97, 123)] + [str(i) for i in range(10)] + ['"', '{', '}', ':', ',', ' ']
      self.vocab_size = len(self.vocab)

  def get_token_mask(self, current_text: str) -> List[bool]:
      mask = [False] * self.vocab_size

      # Get allowed next characters from FSM
      allowed_chars = self.fsm.get_allowed_next_chars(current_text)

      # Check each token in vocabulary
      for token_id in range(self.vocab_size):
          token_str = self.vocab[token_id]
          if token_str and token_str[0] in allowed_chars:
                  mask[token_id] = True

      return mask

if __name__ == "__main__":
  # Define schema
  schema = {
      "type": "object",
      "properties": {
          "name": {"type": "string"},
          "age": {"type": "integer"}
      }
  }

  # Step 1: Schema -> Regex
  regex_pattern = schema_to_regex(schema)
  print(f"Regex pattern: {regex_pattern}")

  # Step 2: Regex -> FSM
  fsm = SimpleFSM(regex_pattern)
  current_generation = '{"name": "arnab", "age": '
  allowed_chars = fsm.get_allowed_next_chars(current_generation)
  print(f"Allowed next characters: {allowed_chars}")

  # Step 3: FSM -> Token Mask
  masker = TokenMasker(fsm)

  current_generation = '{"name": "arnab", "age": '
  mask = masker.get_token_mask(current_generation)
  print(f"Token mask: {mask}")
