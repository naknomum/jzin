#!/usr/bin/perl

use strict;
use FindBin;
use lib $FindBin::Bin;
use JZIN2PDF;
use JSON;
use Data::Dumper;
use utf8;

my $jzin = from_json(join('', <STDIN>), {utf8=>1});
my $pdf = &JZIN2PDF::process_jzin($jzin);

$pdf->save('/dev/stdout');
