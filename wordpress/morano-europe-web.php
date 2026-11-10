<?php
/**
 * Plugin Name:       Morano Europe — Web corporativa
 * Description:       Web de Morano Europe SL en /es/ y /en/: empresa, catálogo, cotización y pedidos por WhatsApp. Se publica desde Ajustes → Web Morano Europe.
 * Version:           __MEW_VERSION__
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Morano Europe SL
 * License:           Propietaria
 *
 * Las páginas son HTML ya compilado (pages/) y los recursos estáticos (site/)
 * los sirve el servidor directamente. Este archivo solo decide qué página
 * corresponde a cada dirección. No toca el tema, Elementor ni otras páginas.
 *
 * Estados (opción mew_live):
 * - Vista previa (por defecto): solo los administradores conectados ven /es/ y /en/.
 * - Publicada: todos los visitantes; la portada / redirige a /es/.
 * Desactivar el plugin devuelve la portada anterior.
 */

defined( 'ABSPATH' ) || exit;

define( 'MEW_VERSION', '__MEW_VERSION__' );
define( 'MEW_OPTION', 'mew_live' );
define( 'MEW_DIR', __DIR__ );

add_action( 'init', 'mew_route', 0 );
add_filter( 'robots_txt', 'mew_robots', 99, 2 );
add_action( 'admin_menu', 'mew_admin_menu' );
add_action( 'admin_init', 'mew_admin_init' );
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'mew_action_links' );
add_action( 'add_option_' . MEW_OPTION, 'mew_purge_cache' );
add_action( 'update_option_' . MEW_OPTION, 'mew_purge_cache' );
register_activation_hook( __FILE__, 'mew_purge_cache' );
register_deactivation_hook( __FILE__, 'mew_purge_cache' );

function mew_is_live() {
	return (bool) get_option( MEW_OPTION, false );
}

/** Decide si la petición es de la web nueva y, si lo es, la sirve y termina. */
function mew_route() {
	if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
		return;
	}
	if ( ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
		return;
	}
	$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( (string) $_SERVER['REQUEST_METHOD'] ) : 'GET';
	if ( 'GET' !== $method && 'HEAD' !== $method ) {
		return;
	}

	$live = mew_is_live();
	if ( ! $live && ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$uri  = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '/';
	$path = (string) wp_parse_url( $uri, PHP_URL_PATH );
	$base = rtrim( (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH ), '/' );
	if ( '' !== $base ) {
		if ( $path !== $base && 0 !== strpos( $path, $base . '/' ) ) {
			return;
		}
		$path = (string) substr( $path, strlen( $base ) );
	}

	// Portada: a /es/ (solo publicada y si no es una consulta propia de WordPress).
	if ( '' === $path || '/' === $path ) {
		if ( $live && mew_is_plain_home_request() ) {
			mew_redirect( '/es/', 302 );
		}
		return;
	}

	if ( '/sitemap.xml' === $path ) {
		if ( $live ) {
			mew_send( MEW_DIR . '/pages/sitemap.xml', 'application/xml; charset=UTF-8', 200 );
		}
		return;
	}

	if ( ! preg_match( '#^/(es|en)(/.*)?$#', $path, $m ) ) {
		return; // Cualquier otra dirección sigue siendo de WordPress.
	}
	$lang = $m[1];
	$rest = isset( $m[2] ) ? $m[2] : '';
	if ( '' === $rest ) {
		mew_redirect( '/' . $lang . '/', 301 );
	}
	if ( ! preg_match( '#^(/[a-z0-9][a-z0-9-]*)*/?$#', $rest ) ) {
		mew_not_found();
	}
	$dir = MEW_DIR . '/pages/' . $lang . rtrim( $rest, '/' );
	if ( ! is_file( $dir . '/index.html' ) ) {
		mew_not_found();
	}
	if ( '/' !== substr( $rest, -1 ) ) {
		mew_redirect( '/' . $lang . $rest . '/', 301 );
	}
	mew_send( $dir . '/index.html', 'text/html; charset=UTF-8', 200 );
}

/** La portada sin parámetros de WordPress (búsquedas, vistas previas, IDs…). */
function mew_is_plain_home_request() {
	$wp_keys = array( 's', 'p', 'page_id', 'preview', 'preview_id', 'preview_nonce', 'attachment_id', 'cat', 'tag', 'author', 'feed', 'm', 'post_type', 'name', 'pagename', 'rest_route', 'sitemap', 'elementor-preview', 'elementor_library', 'customize_changeset_uuid', 'customize_theme', 'doing_wp_cron', 'litespeed_action' );
	foreach ( $wp_keys as $key ) {
		if ( isset( $_GET[ $key ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			return false;
		}
	}
	return true;
}

function mew_clean_buffers() {
	while ( ob_get_level() > 0 ) {
		ob_end_clean();
	}
}

function mew_redirect( $to, $status ) {
	$query = isset( $_SERVER['QUERY_STRING'] ) ? (string) $_SERVER['QUERY_STRING'] : '';
	$url   = home_url( $to ) . ( '' !== $query ? '?' . $query : '' );
	mew_clean_buffers();
	mew_drop_cookies();
	header( 'X-LiteSpeed-Cache-Control: no-cache' );
	wp_redirect( $url, $status, 'Morano Europe' );
	exit;
}

/**
 * La web no usa cookies (ver su política de cookies). Para visitantes sin
 * sesión se quitan las que otros plugins hayan preparado (p. ej. la de
 * LiteSpeed «_lscache_vary»): además, una respuesta con cookie no se cachea.
 */
function mew_drop_cookies() {
	if ( ! is_user_logged_in() ) {
		header_remove( 'Set-Cookie' );
	}
}

function mew_not_found() {
	mew_send( MEW_DIR . '/pages/404.html', 'text/html; charset=UTF-8', 404 );
}

/** Envía un archivo de pages/ con las cabeceras de la web y termina. */
function mew_send( $file, $type, $status ) {
	mew_clean_buffers();
	mew_drop_cookies();
	$cacheable = ( 200 === $status ) && mew_is_live() && ! is_user_logged_in();
	status_header( $status );
	header( 'Content-Type: ' . $type );
	header( 'X-Content-Type-Options: nosniff' );
	header( 'Referrer-Policy: strict-origin-when-cross-origin' );
	header( 'X-Frame-Options: DENY' );
	header( 'Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()' );
	header( "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'" );
	if ( $cacheable ) {
		header( 'Cache-Control: public, max-age=0, must-revalidate' );
		header( 'X-LiteSpeed-Cache-Control: public,max-age=604800' );
		header( 'X-LiteSpeed-Tag: mew' );
	} else {
		nocache_headers();
		header( 'X-LiteSpeed-Cache-Control: no-cache' );
	}
	header( 'Content-Length: ' . filesize( $file ) );
	$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( (string) $_SERVER['REQUEST_METHOD'] ) : 'GET';
	if ( 'HEAD' !== $method ) {
		readfile( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	}
	exit;
}

function mew_robots( $output, $is_public ) {
	if ( ! mew_is_live() || ! $is_public ) {
		return $output;
	}
	return rtrim( $output ) . "\nSitemap: " . home_url( '/sitemap.xml' ) . "\n";
}

/** Vacía la caché de LiteSpeed (si está instalado) al publicar, ocultar o actualizar. */
function mew_purge_cache() {
	do_action( 'litespeed_purge_all' );
}

function mew_admin_init() {
	register_setting(
		'mew',
		MEW_OPTION,
		array(
			'type'              => 'boolean',
			'default'           => false,
			'sanitize_callback' => 'mew_sanitize_bool',
		)
	);
	if ( get_option( 'mew_version' ) !== MEW_VERSION ) {
		update_option( 'mew_version', MEW_VERSION, false );
		mew_purge_cache();
	}
}

function mew_sanitize_bool( $value ) {
	return ! empty( $value );
}

function mew_admin_menu() {
	add_options_page( 'Web Morano Europe', 'Web Morano Europe', 'manage_options', 'morano-europe-web', 'mew_settings_page' );
}

function mew_action_links( $links ) {
	array_unshift( $links, '<a href="' . esc_url( admin_url( 'options-general.php?page=morano-europe-web' ) ) . '">Ajustes</a>' );
	return $links;
}

function mew_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$live = mew_is_live();
	?>
	<div class="wrap">
		<h1>Web Morano Europe</h1>
		<p>
			Estado:
			<strong><?php echo $live ? 'publicada para todos los visitantes' : 'vista previa (solo administradores conectados)'; ?></strong>
		</p>
		<p>
			Páginas:
			<a href="<?php echo esc_url( home_url( '/es/' ) ); ?>" target="_blank" rel="noopener">Español (/es/)</a> ·
			<a href="<?php echo esc_url( home_url( '/en/' ) ); ?>" target="_blank" rel="noopener">English (/en/)</a>
		</p>
		<form method="post" action="options.php">
			<?php settings_fields( 'mew' ); ?>
			<label>
				<input type="checkbox" name="<?php echo esc_attr( MEW_OPTION ); ?>" value="1" <?php checked( $live ); ?> />
				Publicar la web para todos (la portada <code>/</code> pasa a <code>/es/</code>)
			</label>
			<?php submit_button( 'Guardar' ); ?>
		</form>
		<p class="description">
			Versión <?php echo esc_html( MEW_VERSION ); ?>. Las demás páginas de WordPress no cambian.
			Al desactivar el plugin vuelve la portada anterior.
		</p>
	</div>
	<?php
}
