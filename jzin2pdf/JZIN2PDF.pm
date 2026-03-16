package JZIN2PDF;

use strict;
use PDF::API2;
use JSON;
use Data::Dumper;
use utf8;
use MultiParagraph;

my $VERSION = '0.0.5';

my %MAP_FONTS;
my %MAP_IMAGES;
my %MAP_STYLES;
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
        next if ($iname eq 'final.pdf');
        warn "IMAGE:($iname)\n";
        die "file not found: $maps->{images}->{$iname}->{src}" unless (-f $maps->{images}->{$iname}->{src});
        $MAP_IMAGES{$iname} = {
            data => $maps->{images}->{$iname},
            image => undef,
        };
        eval {
            if ($maps->{images}->{$iname}->{src} =~ /\.pdf$/) {
                my $source_pdf = PDF::API2->open($maps->{images}->{$iname}->{src});
                my $source_page = $source_pdf->open_page(1);
                my @size = $source_page->size();
                $MAP_IMAGES{$iname}->{size} = \@size;
                $MAP_IMAGES{$iname}->{image} = $source_pdf->embed_page($source_pdf, 1);
            } else {
                $MAP_IMAGES{$iname}->{image} = $pdf->image($maps->{images}->{$iname}->{src});
            }
        };
        warn "got image-read error $@" if $@;
    }

    # styles is easy
    %MAP_STYLES = %{$maps->{styles}};
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
    } elsif ($el->{elementType} eq 'pdf') {
        &process_element_pdf($page, $el);
    }
}


sub process_element_text {
    my ($page, $el) = @_;
    my $text = $page->text();
    # attempts to get this style, falls back to default, falls back to very basic default
    my $style = $MAP_STYLES{$el->{style}} || {};
    my $defaultStyle = $MAP_STYLES{_DEFAULT_} || {
        fontSize => 12,
        color => 'black',
    };
    # if these are set explicitly, they win over $style
    my $fontSize = $el->{fontSize} || $style->{fontSize} || $defaultStyle->{fontSize} || 12;
    my %options = %{$el->{options}} if $el->{options};
    my $font = $el->{font} || $style->{font} || $defaultStyle->{font};
    if (!$MAP_FONTS{$font}) {
        warn "could not find MAP_FONTS{$font}} (using DEFAULT)";
        $font = $DEFAULT_FONT;
    } else {
        #$font = $MAP_FONTS{$el->{font}}->{font} if ($el->{font} && $MAP_FONTS{$el->{font}});
        $font = $MAP_FONTS{$font}->{font};
    }
    warn "TEXT ELEMENT: " . Dumper($el) . "OPTIONS: " . Dumper(\%options) if $DEBUG;
    $text->font($font, $fontSize);
    $text->fill_color($el->{color} || $style->{color});

    my $x = $el->{position}->[0];
    my $y = $el->{position}->[1];
    my $w = $el->{width} || 0;
    my $h = $el->{height} || 0;

    if ($options{align} eq 'center') {
        $x += $w / 2;
    } elsif ($options{align} eq 'right') {
        $x += $w;
    }

    # needs w/h
    if (($el->{textType} eq 'paragraph') && $w && $h) {
        $y += ($h - $fontSize);
        $text->position($x, $y);
        $h += 200 if $el->{overflow};
        my $over = $text->paragraph($el->{text}, $w, $h + $fontSize * 2, %options);
        warn "+++ overflowed text=($over) on " . Dumper($el) if $over;

    # also needs w/h
    } elsif (($el->{textType} eq 'multi') && $w && $h && (ref($el->{textData}) eq 'HASH')) {
        $text->position($x, $y);
        $el->{textData}->{defaultStyle} = $defaultStyle unless $el->{textData}->{defaultStyle};
        # TODO FIXME should make a generic way to populate/fix styles etc
        $el->{textData}->{defaultStyle}->{font} = $MAP_FONTS{$el->{textData}->{defaultStyle}->{font}}->{font} || $DEFAULT_FONT;
        my ($overflow, $rem_h) = $text->paragraph_multi($el->{textData}, $w, $h);

    } else {
        $text->position($x, $y);
        $text->text($el->{text}, %options);
    }
}


sub process_element_image {
    my ($page, $el) = @_;
    warn "IMAGE ELEMENT: " . Dumper($el) if $DEBUG;
    my $image_key = $el->{image};
    $image_key = $image_key->{'print'} || $image_key->{'web'} if (ref $el->{image} eq 'HASH');
    return unless $image_key;
    warn ">>>>>>>>>>>>>>>>>>>>>> using image_key=$image_key" if $DEBUG;
    die "could not find MAP_IMAGES{$image_key}" unless $MAP_IMAGES{$image_key} && $MAP_IMAGES{$image_key}->{image};

    my $width = $el->{width};
    my $height = $el->{height};

    # for pdf width/height are actually scales, and we need to figure those out
    if ($image_key =~ /\.pdf$/i) {
        my $pdf_width = $MAP_IMAGES{$image_key}->{size}->[2] - $MAP_IMAGES{$image_key}->{size}->[0];
        my $pdf_height = $MAP_IMAGES{$image_key}->{size}->[3] - $MAP_IMAGES{$image_key}->{size}->[1];
#warn "($width, $height)";
        $width = $width / $pdf_width;
        $height = $height / $pdf_height;
        # TODO do we want to force same aspect ratio here?
#warn "(pdf=($pdf_width, $pdf_height) => ($width, $height)";
    }

    $page->object(
        $MAP_IMAGES{$image_key}->{image},
        $el->{position}->[0],
        $el->{position}->[1],
        $width,
        $height,
    );
}

# experimental / hacky
sub process_element_pdf {
    my ($page, $el) = @_;
    warn "PDF ELEMENT: " . Dumper($el) if $DEBUG;
    my $src_path = $el->{src};
    my $source = PDF::API2->open($src_path);
    if (!$source) {
        warn "could not open element_pdf src_path=$src_path: $!";
        return;
    }
    my $page_num = $el->{pageNumber} || 1;
    my $scale = $el->{scale} || 1;
    my $xobject = $pdf->embed_page($source, $page_num);

    $page->object(
        $xobject,
        $el->{position}->[0] + 0,
        $el->{position}->[1] + 0,
        $scale
    );
}

sub pdf_timestamp {
    my @t = (reverse gmtime())[3..8];
    $t[0] += 1900;
    $t[1]++;
    return sprintf('%04d%02d%02d%02d%02d%02d', @t);
}

1;

