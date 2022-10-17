#!/usr/bin/perl

use strict;
use FindBin;
use lib $FindBin::Bin;
use JZIN2PDF;
use JSON;
use Data::Dumper;

my $jzin = from_json(join('', <STDIN>));
my $pdf = &JZIN2PDF::process_jzin($jzin);

$pdf->save('/dev/stdout');
