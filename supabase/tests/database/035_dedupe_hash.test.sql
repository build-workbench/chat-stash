begin;

select plan(4);

select is(
  jsonb_build_array('v1', 'source', 'chatgpt', 'conv-1', 'msg-1')::text,
  '["v1", "source", "chatgpt", "conv-1", "msg-1"]',
  'source-based dedupe vector JSON is stable'
);

select is(
  encode(extensions.digest(
    jsonb_build_array('v1', 'source', 'chatgpt', 'conv-1', 'msg-1')::text,
    'sha256'
  ), 'hex'),
  '1176d7021f8acc05109467b72de309443bbaf07fac3f653304d967aff7fb14f0',
  'source-based dedupe vector hash is fixed'
);

select is(
  jsonb_build_array(
    'v1', 'content', 'chatgpt', 'https://chatgpt.com/c/abc', 'conv-1',
    'Prompt one', 'Response one'
  )::text,
  '["v1", "content", "chatgpt", "https://chatgpt.com/c/abc", "conv-1", "Prompt one", "Response one"]',
  'content-based dedupe vector JSON is stable'
);

select is(
  encode(extensions.digest(
    jsonb_build_array(
      'v1', 'content', 'chatgpt', 'https://chatgpt.com/c/abc', 'conv-1',
      'Prompt one', 'Response one'
    )::text,
    'sha256'
  ), 'hex'),
  '2666b27d9d59c38ea0d944441c4e8452d04d33585d79b6d06e54ce82a0f06091',
  'content-based dedupe vector hash is fixed'
);

select * from finish();
rollback;
