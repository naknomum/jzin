package JZIN2PDF;

use strict;
use PDF::API2;
use JSON;
use Data::Dumper;
use utf8;

my $VERSION = '0.0.3';

my %MAP_FONTS;
my %MAP_IMAGES;
my $pdf;
my $DEFAULT_FONT;
my $DEBUG = 1;

sub process_jzin {
    my $jzin = shift;
    $pdf = PDF::API2->new();
    $DEFAULT_FONT = $pdf->font('Times-Roman');
    &process_maps($jzin->{maps});
    &process_document($jzin->{document});
    $pdf->title($jzin->{meta}->{title}) if $jzin->{meta}->{title};
    $pdf->author($jzin->{meta}->{author}) if $jzin->{meta}->{author};
    $pdf->subject($jzin->{meta}->{subject}) if $jzin->{meta}->{subject};
    $pdf->keywords(join(' ', @{$jzin->{meta}->{keywords}})) if $jzin->{meta}->{keywords};
    $pdf->creator($jzin->{meta}->{creator}) if $jzin->{meta}->{creator};
    $pdf->producer('jzin.org JZIN2PDF ' . $VERSION);
    $pdf->created(&pdf_timestamp());
    $pdf->modified(&pdf_timestamp());
    return $pdf;
}


sub process_maps {
    my ($maps) = @_;

    # fonts
    foreach my $fname (keys %{$maps->{fonts}}) {
        warn "FONT:($fname)\n";
        die "file not found: $maps->{fonts}->{$fname}->{src}" unless (-f $maps->{fonts}->{$fname}->{src});
        $MAP_FONTS{$fname} = {
            data => $maps->{fonts}->{$fname},
            font => $pdf->font($maps->{fonts}->{$fname}->{src}),
        }
    }

    # images
    foreach my $iname (keys %{$maps->{images}}) {
        warn "IMAGE:($iname)\n";
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
    my $fontSize = $el->{fontSize} || 12;
    my %options = %{$el->{options}} if $el->{options};
    warn "could not find MAP_FONTS{$el->{font}} (using DEFAULT)" if ($el->{font} && !$MAP_FONTS{$el->{font}});
    warn "TEXT ELEMENT: " . Dumper($el) . "OPTIONS: " . Dumper(\%options) if $DEBUG;
    $font = $MAP_FONTS{$el->{font}}->{font} if ($el->{font} && $MAP_FONTS{$el->{font}});
    $text->font($font, $fontSize);
    $text->fill_color($el->{color} || 'black');

    my $x = $el->{position}->[0];
    my $y = $el->{position}->[1];
    my $w = $el->{width} || 0;
    my $h = $el->{height} || 0;

    if ($options{align} eq 'center') {
        $x += $w / 2;
    } elsif ($options{align} eq 'right') {
        $x += $w;
    }

    if (($el->{textType} eq 'paragraph') && $el->{width} && $el->{height}) {
        $y += ($h - $fontSize);
        $text->position($x, $y);
        $h += 200 if $el->{overflow};
        my $over = $text->paragraph($el->{text}, $w, $h + $fontSize * 2, %options);
        warn "+++ overflowed text=($over) on " . Dumper($el) if $over;
    } else {
        $text->position($x, $y);
        $text->text($el->{text}, %options);
    }
}


sub process_element_image {
    my ($page, $el) = @_;
    warn "IMAGE ELEMENT: " . Dumper($el) if $DEBUG;
    die "could not find MAP_IMAGES{$el->{image}}" unless $MAP_IMAGES{$el->{image}};
    $page->object(
        $MAP_IMAGES{$el->{image}}->{image},
        $el->{position}->[0],
        $el->{position}->[1],
        $el->{width},
        $el->{height},
    );
}


sub pdf_timestamp {
    my @t = (reverse gmtime())[3..8];
    $t[0] += 1900;
    $t[1]++;
    return sprintf('%04d%02d%02d%02d%02d%02d', @t);
}

1;

