import tempfile,unittest
from pathlib import Path
from private_file_guard import assert_output_paths_safe

class GuardTests(unittest.TestCase):
 def test_distinct_new_output_ok(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d)
   assert_output_paths_safe([root/'prediction.json'],[root/'save.json',root/'key.json'])
 def test_source_save_overwrite_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d); p=root/'original.json'
   with self.assertRaisesRegex(ValueError,'overwrite'):
    assert_output_paths_safe([p],[p])
 def test_evidence_overwrite_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);p=root/'evidence.json'
   with self.assertRaisesRegex(ValueError,'overwrite'):
    assert_output_paths_safe([p],[root/'save.json',p])
 def test_same_public_private_output_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'out.json'
   with self.assertRaisesRegex(ValueError,'distinct'):
    assert_output_paths_safe([p,p],[])
 def test_relative_absolute_alias_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);p=root/'out.json'
   with self.assertRaisesRegex(ValueError,'distinct'):
    assert_output_paths_safe([p,root/'.'/'out.json'],[])
 def test_folder_not_file_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaisesRegex(ValueError,'directory'):
    assert_output_paths_safe([Path(d)],[])
 def test_optional_none_inputs_ignored(self):
  with tempfile.TemporaryDirectory() as d:
   assert_output_paths_safe([Path(d)/'out.json',None],[None])
if __name__=='__main__':unittest.main()
