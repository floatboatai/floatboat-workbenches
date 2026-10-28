import unittest
from unittest.mock import patch
from server import collect
from agent_reach.channels.github import GitHubChannel
from agent_reach.runtime.result import envelope,ReachError,RATE_LIMITED
from agent_reach.utils.url import normalize_public_http_url
import json
class ReachTests(unittest.TestCase):
 def test_real_upstream_channel_parser(self):
  def get(path,timeout,accept=None):
   if path.endswith('/readme'):return b'fixture evidence'
   return json.dumps({'full_name':'sample/project','html_url':'https://github.com/sample/project','owner':{'login':'sample'},'description':'fixture','license':{'spdx_id':'MIT'}}).encode()
  items=GitHubChannel._read(get,'sample/project',10);self.assertEqual(items[0]['text'],'fixture evidence');self.assertEqual(items[0]['raw']['license'],'MIT')
 def test_failed_result_uses_original_error_envelope(self):
  with patch('server.GitHubChannel._search',side_effect=ReachError(RATE_LIMITED,'limit')):
   result=collect({'channel':'github','action':'search','query':'fixture'})['envelope'];self.assertFalse(result['ok']);self.assertEqual(result['items'],[]);self.assertEqual(result['error']['code'],'RATE_LIMITED')
 def test_no_login_channels_or_shell_actions(self):
  for channel,action in [('twitter','read'),('github','login'),('web','install')]:
   with self.assertRaises(ReachError):collect({'channel':channel,'action':action,'query':'example'})
 def test_upstream_public_url_validation(self):
  for target in ['http://127.0.0.1','file:///etc/passwd','https://localhost','https://user:password@example.com']:
   with self.assertRaises(ValueError):normalize_public_http_url(target)
 def test_envelope_constructor_preserves_raw_data(self):
  raw={'exact':[1,2]};r=envelope(channel='web',action='read',backend='fixture',items=[{'raw':raw}]);self.assertEqual(r['schema_version'],1);self.assertEqual(r['items'][0]['raw'],raw)
if __name__=='__main__':unittest.main()
