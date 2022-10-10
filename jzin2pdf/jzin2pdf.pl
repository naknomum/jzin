#!/usr/bin/perl

use strict;
use PDF::API2;
use JSON;
use Data::Dumper;

my $jzin = from_json(join('', <STDIN>));
my $pdf = PDF::API2->new();
my $DEFAULT_FONT = $pdf->font('Times-Roman');

my %MAP_FONTS;
my %MAP_IMAGES;

&process_maps($jzin->{maps});
&process_document($jzin->{document});

$pdf->save('/tmp/test.pdf');




sub process_maps {
    my ($maps) = @_;

    # fonts
    foreach my $fname (keys %{$maps->{fonts}}) {
        print "FONT:($fname)\n";
        $MAP_FONTS{$fname} = {
            data => $maps->{fonts}->{$fname},
            font => $pdf->font($maps->{fonts}->{$fname}->{src}),
        }
    }

    # images
    foreach my $iname (keys %{$maps->{images}}) {
        print "IMAGE:($iname)\n";
        die "file not found: $maps->{images}->{$iname}->{src}" unless (-f $maps->{images}->{$iname}->{src});
        $MAP_IMAGES{$iname} = {
            data => $maps->{images}->{$iname},
            image => $pdf->image($maps->{images}->{$iname}->{src}),
        }
    }
}


sub process_document {
    my ($doc) = @_;

    foreach my $pg_data (@{$doc->{pages}}) {
        my $page = $pdf->page();
        $page->size($pg_data->{size});
        foreach my $el_data (@{$pg_data->{elements}}) {
            &process_element($page, $el_data);
        }
    }
}


sub process_element {
    my ($page, $el) = @_;
    if ($el->{elementType} eq 'text') {
        &process_element_text($page, $el);
    } elsif ($el->{elementType} eq 'image') {
        &process_element_image($page, $el);
    }
}


sub process_element_text {
    my ($page, $el) = @_;
    my $text = $page->text();
    my $font = $DEFAULT_FONT;
    $font = $MAP_FONTS{$el->{font}} if ($el->{font} && $MAP_FONTS{$el->{font}});
    $text->font($font, $el->{fontSize} || 12);
    $text->position($el->{position}->[0], $el->{position}->[1]);
    $text->text($el->{text});
}


sub process_element_image {
    my ($page, $el) = @_;
    $page->object(
        $MAP_IMAGES{$el->{image}}->{image},
        $el->{position}->[0],
        $el->{position}->[1],
        $el->{width},
        $el->{height},
    );
}

