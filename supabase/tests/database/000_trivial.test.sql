begin;
select plan(1);
select ok(true, 'pgTAP runner works');
select * from finish();
rollback;
