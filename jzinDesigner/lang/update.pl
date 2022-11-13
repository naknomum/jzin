#!/usr/bin/perl

# really kinda admin-only; use at own risk?  :)

# usage:  jzinDesigner/lang/update.pl en-us > /tmp/file-to-edit.json
#   this will give you a file to modify and then replace lang/en-us.json


## TODO handle sub/var stuff

use JSON;
my $lang_code = $ARGV[0];
die "usage: $0 lang-code\n" unless $lang_code;

my $prev = {};
if (open(L, "jzinDesigner/lang/$lang_code.json")) {
    $prev = from_json(join('', <L>));
    close L;
} else {
    warn "NOTE: file jzinDesigner/lang/$lang_code.json unavailable - starting from empty: $!\n";
}

delete $prev->{_procDate};
my $new = {
    "_procDate" => scalar(localtime())
};

open(C, 'jzinDesigner/jzinDesigner.js') || die "oops cant open jzinDesigner.js: $!";
while (<C>) {
    while (/text\('(.+?)'\)/ || /text\('(.+?)'\)/) {
        $key = $1;
        $_ = $';
        next if $prev->{$key};
        $new->{$key} = $key;
    }
}
close C;

my $jprev = to_json($prev, {pretty=>1});
my $jnew = to_json($new, {pretty=>1});
my $have_prev = 0;
if ($jprev eq "{}\n") {
    $jprev = "{\n";
} else {
    chop($jprev);
    chop($jprev);
chop($jprev);
    $have_prev = 1;
}

substr($jnew, 0, 1) = '';
$jprev .= ',' if ($have_prev);
$jprev .= "\n\n\n$jnew";

print $jprev;
